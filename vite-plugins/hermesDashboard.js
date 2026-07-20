/*
  hermesDashboardPlugin — dev-only middleware that lets the UI actually
  change Hermes's live model. The gateway API (:8642, used by everything
  else in this app) has no config-write endpoint and ignores a `model`
  field on /v1/runs (confirmed by live testing — a bogus model string ran
  fine, unchanged). The Hermes WebUI *dashboard* (separate service, e.g.
  :9119) DOES have a real one: POST /api/default-model persists
  config.yaml and hot-reloads — no gateway restart. Discovered by reading
  hermes-webui/api/routes.py (set_hermes_default_model) and the dashboard
  login page's inline script (POST /auth/password-login).

  IMPORTANT: this changes the model GLOBALLY — Telegram, Discord, every
  platform Hermes serves, not just this chat. There is no per-run model
  routing available anywhere in this stack today.

  Auth: the dashboard uses session-cookie login, NOT the gateway's bearer
  key. Login path confirmed live: POST /auth/password-login with
  {provider:"basic", username, password, next} — probed with a bogus
  password and got a genuine {"detail":"Invalid credentials"} 401 (the
  local hermes-webui checkout is a different/older revision than what's
  actually deployed on the box, so its source was NOT trusted for this;
  the box's real account record shape — username + password_hash + a
  secret column — suggests real per-account auth, so username is sent
  for real here, not left blank). Credentials live server-side only, in
  .env.local as HERMES_DASHBOARD_USERNAME / HERMES_DASHBOARD_PASSWORD
  (unprefixed — NOT VITE_-prefixed — so Vite never bundles them into
  client JS; password_hash from the box's own storage is USELESS here —
  it's a one-way PBKDF2 hash, login needs the plaintext password). This
  middleware logs in once, caches the session cookie in memory, and
  re-logs-in on 401. The browser only ever talks to same-origin
  /local/dashboard/* — it never sees the cookie, username, or password.
*/

const LOGIN_PATH = "/auth/password-login";
const SET_MODEL_PATH = "/api/default-model";

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export function hermesDashboardPlugin({ baseUrl, username, password }) {
  let cookie = null; /* cached "name=value" session cookie string */
  let loginPromise = null;

  const configured = Boolean(baseUrl && username && password);

  async function login() {
    const res = await fetch(`${baseUrl}${LOGIN_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "basic", username, password, next: "" }),
    });
    if (!res.ok) {
      /* Log the upstream error BODY server-side only (a message like
         "Invalid credentials", never a secret) — invaluable for telling a
         wrong password apart from a wrong username/endpoint/shape. */
      const detail = await res.text().catch(() => "");
      console.error(`[hermes-dashboard] login failed: HTTP ${res.status} — ${detail.slice(0, 300)}`);
      throw Object.assign(new Error(`dashboard login failed (HTTP ${res.status})`), { status: res.status });
    }
    const setCookie = res.headers.get("set-cookie");
    if (!setCookie) throw new Error("dashboard login succeeded but returned no session cookie");
    cookie = setCookie.split(";")[0];
    return cookie;
  }

  async function ensureLoggedIn() {
    if (cookie) return cookie;
    if (!loginPromise) loginPromise = login().finally(() => (loginPromise = null));
    return loginPromise;
  }

  /* One retry after a fresh login if the cached cookie turned out stale. */
  async function authedFetch(path, init) {
    await ensureLoggedIn();
    let res = await fetch(`${baseUrl}${path}`, { ...init, headers: { ...init.headers, Cookie: cookie } });
    if (res.status === 401 || res.status === 302) {
      cookie = null;
      await ensureLoggedIn();
      res = await fetch(`${baseUrl}${path}`, { ...init, headers: { ...init.headers, Cookie: cookie } });
    }
    return res;
  }

  return {
    name: "hermes-dashboard-endpoint",
    configureServer(server) {
      server.middlewares.use("/local/dashboard/model", async (req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");

        if (!configured) {
          res.statusCode = 501;
          res.end(
            JSON.stringify({
              error:
                "Dashboard not configured. Set HERMES_DASHBOARD_BASE_URL, HERMES_DASHBOARD_USERNAME, HERMES_DASHBOARD_PASSWORD in .env.local.",
            })
          );
          return;
        }
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "POST only" }));
          return;
        }

        try {
          const raw = await readBody(req);
          const { model, provider } = raw ? JSON.parse(raw) : {};
          if (!model) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "model is required" }));
            return;
          }
          const upstream = await authedFetch(SET_MODEL_PATH, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model, provider: provider || undefined }),
          });
          const text = await upstream.text();
          res.statusCode = upstream.status;
          res.end(text || JSON.stringify({ ok: upstream.ok }));
        } catch (err) {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: String(err?.message || err) }));
        }
      });

      server.middlewares.use("/local/dashboard/status", (req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ configured, baseUrl: configured ? baseUrl : null }));
      });
    },
  };
}
