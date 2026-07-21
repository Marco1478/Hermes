/*
  hermesBridge — the ONE server-side bridge between this UI and Hermes.
  Replaces the earlier dashboard-only bridge (vite-plugins/hermesDashboard.js)
  per docs/HERMES_UI_BRIDGE_IMPLEMENTATION.md (a plan Hermes itself wrote,
  branch docs/hermes-ui-bridge-plan — followed here after live-verifying every
  endpoint it names against the real gateway + dashboard rather than trusting
  it blindly).

  React never talks to :8642 or :9119 directly for this data — it only calls
  same-origin /local/hermes/*. This file owns knowing which of the two real
  backends (or a static fallback) actually answers each question, and always
  says so honestly in the response (`source` / `warning` fields) rather than
  pretending fallback data is authoritative.

  Endpoints verified live against the real box (2026-07-20/21):
    GET  /health                          (gateway, 200)
    GET  /health/detailed                 (gateway, 200 — bearer required)
    GET  /v1/capabilities                 (gateway, 200)
    GET  /v1/skills                       (gateway, 200)
    GET  /v1/toolsets                     (gateway, 200)
    GET  /api/sessions                    (gateway, 200)
    GET  /api/jobs                        (gateway, 200)
    GET  /api/model/options               (dashboard, 200 — needs session cookie)
    GET  /api/model/auxiliary             (dashboard, 200)
    POST /api/model/set                   (dashboard, 200) — NOT /api/default-model,
                                           which 404s ("No such API endpoint") on
                                           this deployed build despite being the
                                           plan's first guess.
    POST /auth/password-login             (dashboard login)

  Dashboard model catalog is namespaced by provider — e.g. the "nous" portal
  lists "openai/gpt-5.5", while "openai-codex" (Marco's actual account, its
  own weekly quota) lists bare "gpt-5.5". /api/model/set needs BOTH provider
  and model to land on the right one — passing model alone silently landed on
  whichever provider matched first, which was the whole earlier saga.
*/

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

export function hermesBridgePlugin({
  gatewayBaseUrl,
  gatewayApiKey,
  dashboardBaseUrl,
  dashboardUsername,
  dashboardPassword,
}) {
  const gatewayConfigured = Boolean(gatewayBaseUrl && gatewayApiKey);
  const dashboardConfigured = Boolean(dashboardBaseUrl && dashboardUsername && dashboardPassword);

  // ---- Gateway (bearer token, stateless) ---------------------------------
  async function gatewayFetch(path, init = {}) {
    return fetch(`${gatewayBaseUrl}${path}`, {
      ...init,
      headers: { ...(init.headers || {}), Authorization: `Bearer ${gatewayApiKey}` },
    });
  }

  // ---- Dashboard (session-cookie login, cached in memory) ---------------
  let dashCookie = null;
  let dashLoginPromise = null;

  async function dashLogin() {
    const res = await fetch(`${dashboardBaseUrl}/auth/password-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "basic", username: dashboardUsername, password: dashboardPassword, next: "" }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[hermes-bridge] dashboard login failed: HTTP ${res.status} — ${detail.slice(0, 300)}`);
      throw Object.assign(new Error(`dashboard login failed (HTTP ${res.status})`), { status: res.status });
    }
    const setCookie = res.headers.get("set-cookie");
    if (!setCookie) throw new Error("dashboard login succeeded but returned no session cookie");
    dashCookie = setCookie.split(";")[0];
    return dashCookie;
  }

  async function ensureDashLogin() {
    if (dashCookie) return dashCookie;
    if (!dashLoginPromise) dashLoginPromise = dashLogin().finally(() => (dashLoginPromise = null));
    return dashLoginPromise;
  }

  async function dashFetch(path, init = {}) {
    await ensureDashLogin();
    let res = await fetch(`${dashboardBaseUrl}${path}`, { ...init, headers: { ...(init.headers || {}), Cookie: dashCookie } });
    if (res.status === 401 || res.status === 302) {
      dashCookie = null;
      await ensureDashLogin();
      res = await fetch(`${dashboardBaseUrl}${path}`, { ...init, headers: { ...(init.headers || {}), Cookie: dashCookie } });
    }
    return res;
  }

  // ---- Generic pass-through for simple gateway GETs ----------------------
  function gatewayGetRoute(localPath, upstreamPath) {
    return async (req, res) => {
      if (!gatewayConfigured) {
        sendJson(res, 501, { error: "Gateway not configured (VITE_GATEWAY_BASE_URL / VITE_GATEWAY_API_KEY)." });
        return;
      }
      try {
        const upstream = await gatewayFetch(upstreamPath);
        const text = await upstream.text();
        res.statusCode = upstream.status;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(text);
      } catch (err) {
        sendJson(res, 502, { error: String(err?.message || err) });
      }
    };
  }

  // ---- Generic pass-through for dashboard GETs (session-cookie auth) ------
  function dashGetRoute(upstreamPath) {
    return async (req, res) => {
      if (!dashboardConfigured) {
        sendJson(res, 501, { error: "Dashboard not configured (HERMES_DASHBOARD_* in .env.local)." });
        return;
      }
      try {
        const upstream = await dashFetch(upstreamPath);
        const text = await upstream.text();
        res.statusCode = upstream.status;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(text);
      } catch (err) {
        sendJson(res, 502, { error: String(err?.message || err) });
      }
    };
  }

  // ---- Generic pass-through for dashboard writes (POST/PUT/DELETE) --------
  function dashWriteRoute(upstreamPath, method) {
    return async (req, res) => {
      if (req.method !== method) {
        sendJson(res, 405, { error: `${method} only` });
        return;
      }
      if (!dashboardConfigured) {
        sendJson(res, 501, { error: "Dashboard not configured (HERMES_DASHBOARD_* in .env.local)." });
        return;
      }
      try {
        const raw = await readBody(req);
        const upstream = await dashFetch(typeof upstreamPath === "function" ? upstreamPath(req) : upstreamPath, {
          method,
          headers: { "Content-Type": "application/json" },
          body: raw || "{}",
        });
        const text = await upstream.text();
        res.statusCode = upstream.status;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(text || JSON.stringify({ ok: upstream.ok }));
      } catch (err) {
        sendJson(res, 502, { error: String(err?.message || err) });
      }
    };
  }

  return {
    name: "hermes-bridge",
    configureServer(server) {
      const use = (path, handler) => server.middlewares.use(path, handler);

      use("/local/hermes/health/detailed", gatewayGetRoute("health/detailed", "/health/detailed"));
      use("/local/hermes/health", gatewayGetRoute("health", "/health"));
      use("/local/hermes/capabilities", gatewayGetRoute("capabilities", "/v1/capabilities"));
      // NOTE: Connect/Vite's server.middlewares.use(path, fn) matches by
      // PREFIX, first-registered-wins — it does NOT pick the most specific
      // match. Every sub-path (here: skills/full, skills/toggle) MUST be
      // registered before its shorter parent prefix (skills), or the
      // parent's handler silently swallows the sub-path's requests too.
      // (Same rule applied below for profiles/soul vs profiles.)
      //
      // Dashboard's /api/skills is richer than the gateway's /v1/skills —
      // includes `enabled`/`usage`/`provenance` per skill, needed for a real
      // toggle. Verified against web_server.py's GET /api/skills handler.
      use("/local/hermes/skills/full", dashGetRoute("/api/skills"));
      use("/local/hermes/skills/toggle", dashWriteRoute("/api/skills/toggle", "PUT"));
      use("/local/hermes/skills", gatewayGetRoute("skills", "/v1/skills"));
      use("/local/hermes/toolsets", gatewayGetRoute("toolsets", "/v1/toolsets"));
      use("/local/hermes/sessions", gatewayGetRoute("sessions", "/api/sessions"));

      // ---- Dashboard-sourced reads (richer than the gateway equivalents) ----
      use("/local/hermes/analytics/usage", dashGetRoute("/api/analytics/usage"));
      use("/local/hermes/analytics/models", dashGetRoute("/api/analytics/models"));
      use("/local/hermes/system/stats", dashGetRoute("/api/system/stats"));
      use("/local/hermes/messaging/platforms", dashGetRoute("/api/messaging/platforms"));
      use("/local/hermes/config", dashGetRoute("/api/config"));
      use("/local/hermes/profiles/soul", async (req, res) => {
        const name = new URL(req.url, "http://x").searchParams.get("name") || "default";
        if (req.method === "PUT") return dashWriteRoute(`/api/profiles/${encodeURIComponent(name)}/soul`, "PUT")(req, res);
        return dashGetRoute(`/api/profiles/${encodeURIComponent(name)}/soul`)(req, res);
      });
      use("/local/hermes/profiles", dashGetRoute("/api/profiles"));
      use("/local/hermes/memory", dashGetRoute("/api/memory"));
      use("/local/hermes/learning/graph", dashGetRoute("/api/learning/graph"));
      use("/local/hermes/mcp/servers", dashGetRoute("/api/mcp/servers"));
      // Cron jobs — the manageable ones live on the dashboard, not the gateway.
      use("/local/hermes/cron/jobs", dashGetRoute("/api/cron/jobs"));
      use("/local/hermes/jobs", dashGetRoute("/api/cron/jobs"));

      // ---- Dashboard writes -------------------------------------------------
      use("/local/hermes/gateway/restart", dashWriteRoute("/api/gateway/restart", "POST"));
      use("/local/hermes/cron/pause", dashWriteRoute((req) => `/api/cron/jobs/${req.url.split("?id=")[1] || ""}/pause`, "POST"));
      use("/local/hermes/cron/resume", dashWriteRoute((req) => `/api/cron/jobs/${req.url.split("?id=")[1] || ""}/resume`, "POST"));
      use("/local/hermes/cron/trigger", dashWriteRoute((req) => `/api/cron/jobs/${req.url.split("?id=")[1] || ""}/trigger`, "POST"));
      // Real endpoint wraps the partial update in {updates: {...}} — verified
      // against /opt/hermes/hermes_cli/web_server.py's CronJobUpdate model
      // (accepts name/prompt/schedule/etc, all pass through un-normalized).
      use("/local/hermes/cron/update", async (req, res) => {
        if (req.method !== "PUT") {
          sendJson(res, 405, { error: "PUT only" });
          return;
        }
        if (!dashboardConfigured) {
          sendJson(res, 501, { error: "Dashboard not configured (HERMES_DASHBOARD_* in .env.local)." });
          return;
        }
        try {
          const id = new URL(req.url, "http://x").searchParams.get("id") || "";
          const raw = await readBody(req);
          const updates = raw ? JSON.parse(raw) : {};
          const upstream = await dashFetch(`/api/cron/jobs/${encodeURIComponent(id)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ updates }),
          });
          const text = await upstream.text();
          res.statusCode = upstream.status;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(text || JSON.stringify({ ok: upstream.ok }));
        } catch (err) {
          sendJson(res, 502, { error: String(err?.message || err) });
        }
      });

      // ---- Models: dashboard-sourced, normalized, honest fallback -------
      use("/local/hermes/models", async (req, res) => {
        if (!dashboardConfigured) {
          sendJson(res, 200, {
            configured: false,
            source: "static-fallback",
            current: null,
            options: [],
            warning: "Dashboard not configured (HERMES_DASHBOARD_* in .env.local) — using static model list client-side.",
          });
          return;
        }
        try {
          const upstream = await dashFetch("/api/model/options");
          if (!upstream.ok) {
            sendJson(res, 200, {
              configured: true,
              source: "static-fallback",
              current: null,
              options: [],
              warning: `Dashboard model options unavailable (HTTP ${upstream.status}) — using static model list client-side.`,
            });
            return;
          }
          const raw = await upstream.json();
          const providers = Array.isArray(raw?.providers) ? raw.providers : [];
          const options = [];
          for (const p of providers) {
            for (const m of p.models || []) {
              options.push({ provider: p.slug, label: m, model: m, available: true, isCurrentProvider: Boolean(p.is_current) });
            }
          }
          sendJson(res, 200, {
            configured: true,
            source: "dashboard",
            current: null, // the dashboard's own /api/model/options doesn't mark a single active model+provider pair reliably
            options,
            warning: null,
          });
        } catch (err) {
          sendJson(res, 200, {
            configured: true,
            source: "static-fallback",
            current: null,
            options: [],
            warning: `Dashboard unreachable (${err?.message || err}) — using static model list client-side.`,
          });
        }
      });

      // ---- Model set: real endpoint is /api/model/set, NOT /api/default-model ----
      use("/local/hermes/model/set", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "POST only" });
          return;
        }
        if (!dashboardConfigured) {
          sendJson(res, 501, {
            error: "Dashboard not configured. Set HERMES_DASHBOARD_BASE_URL/USERNAME/PASSWORD in .env.local.",
          });
          return;
        }
        try {
          const raw = await readBody(req);
          const { model, provider } = raw ? JSON.parse(raw) : {};
          if (!model || !provider) {
            sendJson(res, 400, { error: "model and provider are both required" });
            return;
          }
          const upstream = await dashFetch("/api/model/set", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scope: "main", model, provider }),
          });
          const text = await upstream.text();
          res.statusCode = upstream.status;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(text || JSON.stringify({ ok: upstream.ok }));
        } catch (err) {
          sendJson(res, 502, { error: String(err?.message || err) });
        }
      });

      use("/local/hermes/dashboard/status", (req, res) => {
        sendJson(res, 200, { configured: dashboardConfigured, baseUrl: dashboardConfigured ? dashboardBaseUrl : null });
      });
    },
  };
}
