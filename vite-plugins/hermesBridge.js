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

import { createKanbanExec } from "./kanbanBridge.js";
import { createPluginsExec } from "./pluginsBridge.js";
import { createObsidianExec, safeRelPath, safeFileName, noteToMarkdown, markdownToNote, projectToMarkdown, markdownToProject } from "./obsidianBridge.js";

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
  sshHost,
  sshKeyPath,
  obsidianVaultPath,
  obsidianNotesDir,
  obsidianProjectsDir,
  obsidianArchiveDir,
}) {
  const gatewayConfigured = Boolean(gatewayBaseUrl && gatewayApiKey);
  const dashboardConfigured = Boolean(dashboardBaseUrl && dashboardUsername && dashboardPassword);
  const kanban = createKanbanExec({ sshHost, sshKeyPath });
  const plugins = createPluginsExec({ sshHost, sshKeyPath });
  const obsidian = createObsidianExec({
    sshHost,
    sshKeyPath,
    vaultPath: obsidianVaultPath,
    notesDir: obsidianNotesDir,
    projectsDir: obsidianProjectsDir,
    archiveDir: obsidianArchiveDir,
  });

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
      // Real endpoint verified: PUT /api/tools/toolsets/{name} body
      // {enabled, profile?} — web_server.py's ToolsetToggle model.
      use("/local/hermes/toolsets/toggle", async (req, res) => {
        const name = new URL(req.url, "http://x").searchParams.get("name") || "";
        return dashWriteRoute(`/api/tools/toolsets/${encodeURIComponent(name)}`, "PUT")(req, res);
      });
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
      // Memory/skill node CRUD — real backend only supports GET (prefill),
      // PUT (edit), DELETE (archive/remove). Verified against
      // agent/learning_mutations.py: there is no create-node function, so
      // "add a new memory" has no real endpoint yet (documented as a
      // blocker rather than faked).
      use("/local/hermes/learning/node", async (req, res) => {
        if (!dashboardConfigured) {
          sendJson(res, 501, { error: "Dashboard not configured (HERMES_DASHBOARD_* in .env.local)." });
          return;
        }
        const id = new URL(req.url, "http://x").searchParams.get("id") || "";
        if (req.method === "GET") return dashGetRoute(`/api/learning/node?id=${encodeURIComponent(id)}`)(req, res);
        if (req.method === "PUT") return dashWriteRoute("/api/learning/node", "PUT")(req, res);
        if (req.method === "DELETE") return dashWriteRoute("/api/learning/node", "DELETE")(req, res);
        sendJson(res, 405, { error: "GET, PUT, or DELETE only" });
      });
      // Real endpoint verified: PUT /api/mcp/servers/{name}/enabled body
      // {enabled, profile?} — web_server.py's MCPEnabledToggle model.
      use("/local/hermes/mcp/servers/toggle", async (req, res) => {
        const name = new URL(req.url, "http://x").searchParams.get("name") || "";
        return dashWriteRoute(`/api/mcp/servers/${encodeURIComponent(name)}/enabled`, "PUT")(req, res);
      });
      use("/local/hermes/mcp/servers", dashGetRoute("/api/mcp/servers"));
      // Cron jobs — the manageable ones live on the dashboard, not the gateway.
      use("/local/hermes/cron/jobs", dashGetRoute("/api/cron/jobs"));
      use("/local/hermes/jobs", dashGetRoute("/api/cron/jobs"));
      // Real endpoint verified: POST /api/cron/jobs body {prompt, schedule
      // (cron string), name, deliver, model?, provider?, enabled_toolsets?,
      // ...} — web_server.py's CronJobCreate model.
      use("/local/hermes/cron/create", dashWriteRoute("/api/cron/jobs", "POST"));
      // Real endpoint verified: DELETE /api/cron/jobs/{job_id} (route table
      // dump from web_server.py) — used to clean up a test job after
      // create-flow verification.
      use("/local/hermes/cron/delete", async (req, res) => {
        const id = new URL(req.url, "http://x").searchParams.get("id") || "";
        return dashWriteRoute(`/api/cron/jobs/${encodeURIComponent(id)}`, "DELETE")(req, res);
      });

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

      // ---- Pairing (DM onboarding approvals) — real dashboard endpoints ----
      // GET /api/pairing -> {pending, approved}; verified against
      // web_server.py's PairingApprove/PairingRevoke models.
      use("/local/hermes/pairing/approve", dashWriteRoute("/api/pairing/approve", "POST"));
      use("/local/hermes/pairing/revoke", dashWriteRoute("/api/pairing/revoke", "POST"));
      use("/local/hermes/pairing/clear-pending", dashWriteRoute("/api/pairing/clear-pending", "POST"));
      use("/local/hermes/pairing", dashGetRoute("/api/pairing"));

      use("/local/hermes/dashboard/status", (req, res) => {
        sendJson(res, 200, { configured: dashboardConfigured, baseUrl: dashboardConfigured ? dashboardBaseUrl : null });
      });

      // ---- Kanban: no HTTP surface exists (verified against web_server.py) —
      // every verb below shells out to the real `hermes kanban ...` CLI
      // inside the container over the SSH bridge. See kanbanBridge.js for
      // the sanitization contract.
      use("/local/kanban/status", (req, res) => {
        sendJson(res, 200, { configured: kanban.configured });
      });

      use("/local/kanban/stats", async (req, res) => {
        const result = await kanban.runJson(["stats", "--json"]);
        sendJson(res, result.ok ? 200 : 502, result);
      });

      use("/local/kanban/boards", async (req, res) => {
        const result = await kanban.runJson(["boards", "list", "--json"]);
        sendJson(res, result.ok ? 200 : 502, result);
      });

      use("/local/kanban/assignees", async (req, res) => {
        const result = await kanban.runJson(["assignees", "--json"]);
        sendJson(res, result.ok ? 200 : 502, result);
      });

      use("/local/kanban/list", async (req, res) => {
        const q = new URL(req.url, "http://x").searchParams;
        const args = ["list", "--json"];
        if (q.get("status")) args.push("--status", q.get("status"));
        if (q.get("assignee")) args.push("--assignee", q.get("assignee"));
        if (q.get("archived") === "1") args.push("--archived");
        if (q.get("sort")) args.push("--sort", q.get("sort"));
        const result = await kanban.runJson(args);
        sendJson(res, result.ok ? 200 : 502, result);
      });

      use("/local/kanban/show", async (req, res) => {
        const id = new URL(req.url, "http://x").searchParams.get("id") || "";
        if (!id) {
          sendJson(res, 400, { ok: false, error: "id is required" });
          return;
        }
        const result = await kanban.runJson(["show", id, "--json"]);
        sendJson(res, result.ok ? 200 : 502, result);
      });

      use("/local/kanban/create", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "POST only" });
          return;
        }
        let body;
        try {
          body = JSON.parse((await readBody(req)) || "{}");
        } catch {
          sendJson(res, 400, { ok: false, error: "invalid JSON body" });
          return;
        }
        const { title, body: openingPost, assignee, priority, parent, triage, initialStatus } = body;
        if (!title) {
          sendJson(res, 400, { ok: false, error: "title is required" });
          return;
        }
        const args = ["create", title, "--json"];
        if (openingPost) args.push("--body", openingPost);
        if (assignee) args.push("--assignee", assignee);
        if (priority != null) args.push("--priority", String(priority));
        if (parent) args.push("--parent", parent);
        if (triage) args.push("--triage");
        // Real CLI flag: --initial-status {blocked,running}. "running" is
        // deliberately not offered from the column "+ add card" affordance
        // (see KanbanPage.jsx) — a task can't honestly be "running" unless
        // a worker really is, and creating one straight into that column
        // with nothing behind it would be exactly the fake state this
        // bridge has avoided everywhere else.
        if (initialStatus === "blocked" || initialStatus === "running") args.push("--initial-status", initialStatus);
        const result = await kanban.runJson(args);
        sendJson(res, result.ok ? 200 : 502, result);
      });

      use("/local/kanban/assign", async (req, res) => {
        if (req.method !== "PUT") {
          sendJson(res, 405, { ok: false, error: "PUT only" });
          return;
        }
        let body;
        try {
          body = JSON.parse((await readBody(req)) || "{}");
        } catch {
          sendJson(res, 400, { ok: false, error: "invalid JSON body" });
          return;
        }
        if (!body.id || !body.profile) {
          sendJson(res, 400, { ok: false, error: "id and profile are required" });
          return;
        }
        const result = await kanban.runText(["assign", body.id, body.profile]);
        sendJson(res, result.ok ? 200 : 502, result);
      });

      use("/local/kanban/comment", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "POST only" });
          return;
        }
        let body;
        try {
          body = JSON.parse((await readBody(req)) || "{}");
        } catch {
          sendJson(res, 400, { ok: false, error: "invalid JSON body" });
          return;
        }
        if (!body.id || !body.text) {
          sendJson(res, 400, { ok: false, error: "id and text are required" });
          return;
        }
        const args = ["comment", body.id, body.text];
        if (body.author) args.push("--author", body.author);
        const result = await kanban.runText(args);
        sendJson(res, result.ok ? 200 : 502, result);
      });

      use("/local/kanban/block", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "POST only" });
          return;
        }
        let body;
        try {
          body = JSON.parse((await readBody(req)) || "{}");
        } catch {
          sendJson(res, 400, { ok: false, error: "invalid JSON body" });
          return;
        }
        if (!body.id) {
          sendJson(res, 400, { ok: false, error: "id is required" });
          return;
        }
        const args = ["block", body.id];
        if (body.reason) args.push(body.reason);
        if (body.kind) args.push("--kind", body.kind);
        const result = await kanban.runText(args);
        sendJson(res, result.ok ? 200 : 502, result);
      });

      use("/local/kanban/unblock", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "POST only" });
          return;
        }
        let body;
        try {
          body = JSON.parse((await readBody(req)) || "{}");
        } catch {
          sendJson(res, 400, { ok: false, error: "invalid JSON body" });
          return;
        }
        const ids = Array.isArray(body.ids) ? body.ids : body.id ? [body.id] : [];
        if (ids.length === 0) {
          sendJson(res, 400, { ok: false, error: "ids (or id) is required" });
          return;
        }
        const args = ["unblock", ...ids];
        if (body.reason) args.push("--reason", body.reason);
        const result = await kanban.runText(args);
        sendJson(res, result.ok ? 200 : 502, result);
      });

      use("/local/kanban/promote", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "POST only" });
          return;
        }
        let body;
        try {
          body = JSON.parse((await readBody(req)) || "{}");
        } catch {
          sendJson(res, 400, { ok: false, error: "invalid JSON body" });
          return;
        }
        if (!body.id) {
          sendJson(res, 400, { ok: false, error: "id is required" });
          return;
        }
        const args = ["promote", body.id];
        if (body.reason) args.push(body.reason);
        const result = await kanban.runText(args);
        sendJson(res, result.ok ? 200 : 502, result);
      });

      use("/local/kanban/complete", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "POST only" });
          return;
        }
        let body;
        try {
          body = JSON.parse((await readBody(req)) || "{}");
        } catch {
          sendJson(res, 400, { ok: false, error: "invalid JSON body" });
          return;
        }
        const ids = Array.isArray(body.ids) ? body.ids : body.id ? [body.id] : [];
        if (ids.length === 0) {
          sendJson(res, 400, { ok: false, error: "ids (or id) is required" });
          return;
        }
        const args = ["complete", ...ids];
        if (body.result) args.push("--result", body.result);
        if (body.summary) args.push("--summary", body.summary);
        const result = await kanban.runText(args);
        sendJson(res, result.ok ? 200 : 502, result);
      });

      use("/local/kanban/archive", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "POST only" });
          return;
        }
        let body;
        try {
          body = JSON.parse((await readBody(req)) || "{}");
        } catch {
          sendJson(res, 400, { ok: false, error: "invalid JSON body" });
          return;
        }
        const ids = Array.isArray(body.ids) ? body.ids : body.id ? [body.id] : [];
        if (ids.length === 0) {
          sendJson(res, 400, { ok: false, error: "ids (or id) is required" });
          return;
        }
        const result = await kanban.runText(["archive", ...ids]);
        sendJson(res, result.ok ? 200 : 502, result);
      });

      use("/local/kanban/link", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "POST only" });
          return;
        }
        let body;
        try {
          body = JSON.parse((await readBody(req)) || "{}");
        } catch {
          sendJson(res, 400, { ok: false, error: "invalid JSON body" });
          return;
        }
        if (!body.parentId || !body.childId) {
          sendJson(res, 400, { ok: false, error: "parentId and childId are required" });
          return;
        }
        const result = await kanban.runText(["link", body.parentId, body.childId]);
        sendJson(res, result.ok ? 200 : 502, result);
      });

      use("/local/kanban/unlink", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "POST only" });
          return;
        }
        let body;
        try {
          body = JSON.parse((await readBody(req)) || "{}");
        } catch {
          sendJson(res, 400, { ok: false, error: "invalid JSON body" });
          return;
        }
        if (!body.parentId || !body.childId) {
          sendJson(res, 400, { ok: false, error: "parentId and childId are required" });
          return;
        }
        const result = await kanban.runText(["unlink", body.parentId, body.childId]);
        sendJson(res, result.ok ? 200 : 502, result);
      });

      use("/local/kanban/dispatch", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "POST only" });
          return;
        }
        let body;
        try {
          body = JSON.parse((await readBody(req)) || "{}");
        } catch {
          sendJson(res, 400, { ok: false, error: "invalid JSON body" });
          return;
        }
        const args = ["dispatch", "--json"];
        if (body.dryRun) args.push("--dry-run");
        if (body.max != null) args.push("--max", String(Math.max(1, Math.min(5, Number(body.max) || 1))));
        const result = await kanban.runJson(args);
        sendJson(res, result.ok ? 200 : 502, result);
      });

      // ---- Plugins: no HTTP surface exists either (same story as Kanban) —
      // every verb shells out to the real `hermes plugins ...` CLI inside
      // the container over the SSH bridge. See pluginsBridge.js.
      use("/local/plugins/status", (req, res) => {
        sendJson(res, 200, { configured: plugins.configured });
      });

      use("/local/plugins/list", async (req, res) => {
        const result = await plugins.runJson(["list", "--json"]);
        sendJson(res, result.ok ? 200 : 502, result);
      });

      use("/local/plugins/enable", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "POST only" });
          return;
        }
        let body;
        try {
          body = JSON.parse((await readBody(req)) || "{}");
        } catch {
          sendJson(res, 400, { ok: false, error: "invalid JSON body" });
          return;
        }
        if (!body.name) {
          sendJson(res, 400, { ok: false, error: "name is required" });
          return;
        }
        // Always non-interactive, and never grants tool-override permission
        // from a toggle — a plugin that needs to replace a built-in tool
        // (shell_exec, write_file, ...) has to be enabled from the CLI
        // directly, where that confirmation prompt actually means something.
        const result = await plugins.runText(["enable", body.name, "--no-allow-tool-override"]);
        sendJson(res, result.ok ? 200 : 502, result);
      });

      use("/local/plugins/disable", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "POST only" });
          return;
        }
        let body;
        try {
          body = JSON.parse((await readBody(req)) || "{}");
        } catch {
          sendJson(res, 400, { ok: false, error: "invalid JSON body" });
          return;
        }
        if (!body.name) {
          sendJson(res, 400, { ok: false, error: "name is required" });
          return;
        }
        const result = await plugins.runText(["disable", body.name]);
        sendJson(res, result.ok ? 200 : 502, result);
      });

      // ---- Obsidian vault: no HTTP surface either — every operation is
      // SSH-exec'd against the real markdown files inside the container.
      // See obsidianBridge.js for the filesystem contract and path safety
      // (every id the client sends is validated with safeRelPath before it
      // ever touches a shell command).
      use("/local/obsidian/status", async (req, res) => {
        const result = await obsidian.status();
        sendJson(res, 200, result);
      });

      use("/local/obsidian/notes/read", async (req, res) => {
        if (!obsidian.configured) {
          sendJson(res, 501, { ok: false, error: "Obsidian vault not configured" });
          return;
        }
        const relPath = safeRelPath(new URL(req.url, "http://x").searchParams.get("path") || "");
        if (!relPath) {
          sendJson(res, 400, { ok: false, error: "invalid path" });
          return;
        }
        const result = await obsidian.readFile(obsidian.dirs.notes, relPath);
        if (!result.ok) {
          sendJson(res, 502, result);
          return;
        }
        sendJson(res, 200, { ok: true, data: markdownToNote(relPath, result.raw) });
      });

      use("/local/obsidian/notes/list", async (req, res) => {
        if (!obsidian.configured) {
          sendJson(res, 200, { ok: true, data: [] });
          return;
        }
        const archived = new URL(req.url, "http://x").searchParams.get("archived") === "1";
        const dir = archived ? obsidian.dirs.archive : obsidian.dirs.notes;
        const result = await obsidian.listFiles(dir, "flat");
        if (!result.ok) {
          sendJson(res, 502, result);
          return;
        }
        const data = result.files.map((f) => ({ ...markdownToNote(f.relPath, f.raw), archived }));
        sendJson(res, 200, { ok: true, data });
      });

      use("/local/obsidian/notes/write", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "POST only" });
          return;
        }
        if (!obsidian.configured) {
          sendJson(res, 501, { ok: false, error: "Obsidian vault not configured" });
          return;
        }
        let body;
        try {
          body = JSON.parse((await readBody(req)) || "{}");
        } catch {
          sendJson(res, 400, { ok: false, error: "invalid JSON body" });
          return;
        }
        const note = body.note || {};
        let relPath = body.id ? safeRelPath(body.id) : null;
        if (body.id && !relPath) {
          sendJson(res, 400, { ok: false, error: "invalid path" });
          return;
        }
        if (!relPath) {
          const base = safeFileName(note.title);
          let candidate = `${base}.md`;
          for (let n = 2; await obsidian.exists(obsidian.dirs.notes, candidate); n++) {
            if (n > 200) {
              sendJson(res, 500, { ok: false, error: "could not find a free filename" });
              return;
            }
            candidate = `${base} (${n}).md`;
          }
          relPath = candidate;
        }
        const now = Date.now();
        const record = { ...note, createdAt: note.createdAt || now, updatedAt: now };
        const result = await obsidian.writeFile(obsidian.dirs.notes, relPath, noteToMarkdown(record));
        if (!result.ok) {
          sendJson(res, 502, result);
          return;
        }
        sendJson(res, 200, { ok: true, data: { ...record, id: relPath, archived: false } });
      });

      const noteArchiveRoute = (archiving) => async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "POST only" });
          return;
        }
        if (!obsidian.configured) {
          sendJson(res, 501, { ok: false, error: "Obsidian vault not configured" });
          return;
        }
        let body;
        try {
          body = JSON.parse((await readBody(req)) || "{}");
        } catch {
          sendJson(res, 400, { ok: false, error: "invalid JSON body" });
          return;
        }
        const relPath = safeRelPath(body.id);
        if (!relPath) {
          sendJson(res, 400, { ok: false, error: "invalid path" });
          return;
        }
        const [fromDir, toDir] = archiving ? [obsidian.dirs.notes, obsidian.dirs.archive] : [obsidian.dirs.archive, obsidian.dirs.notes];
        const result = await obsidian.move(fromDir, relPath, toDir, relPath);
        sendJson(res, result.ok ? 200 : 502, result);
      };
      use("/local/obsidian/notes/archive", noteArchiveRoute(true));
      use("/local/obsidian/notes/unarchive", noteArchiveRoute(false));

      use("/local/obsidian/projects/list", async (req, res) => {
        if (!obsidian.configured) {
          sendJson(res, 200, { ok: true, data: [] });
          return;
        }
        const archived = new URL(req.url, "http://x").searchParams.get("archived") === "1";
        const dir = archived ? obsidian.dirs.archive : obsidian.dirs.projects;
        const result = await obsidian.listFiles(dir, "nested");
        if (!result.ok) {
          sendJson(res, 502, result);
          return;
        }
        const data = result.files.map((f) => {
          const project = markdownToProject(f.relPath, f.raw);
          return { ...project, archived, linkedNoteIds: project.linkedNoteRefs.map((ref) => `${ref}.md`) };
        });
        sendJson(res, 200, { ok: true, data });
      });

      use("/local/obsidian/projects/write", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "POST only" });
          return;
        }
        if (!obsidian.configured) {
          sendJson(res, 501, { ok: false, error: "Obsidian vault not configured" });
          return;
        }
        let body;
        try {
          body = JSON.parse((await readBody(req)) || "{}");
        } catch {
          sendJson(res, 400, { ok: false, error: "invalid JSON body" });
          return;
        }
        const project = body.project || {};
        const isNew = !body.id;
        let relPath = body.id ? safeRelPath(body.id) : null;
        if (body.id && !relPath) {
          sendJson(res, 400, { ok: false, error: "invalid path" });
          return;
        }
        if (!relPath) {
          const base = safeFileName(project.name);
          let candidate = base;
          for (let n = 2; await obsidian.exists(obsidian.dirs.projects, `${candidate}/overview.md`); n++) {
            if (n > 200) {
              sendJson(res, 500, { ok: false, error: "could not find a free folder name" });
              return;
            }
            candidate = `${base} (${n})`;
          }
          relPath = candidate;
        }
        const now = Date.now();
        const linkedNoteRefs = (project.linkedNoteIds || []).map((id) => id.replace(/\.md$/, ""));
        const record = { ...project, linkedNoteRefs, createdAt: project.createdAt || now, updatedAt: now };
        const result = await obsidian.writeFile(obsidian.dirs.projects, `${relPath}/overview.md`, projectToMarkdown(record));
        if (!result.ok) {
          sendJson(res, 502, result);
          return;
        }
        if (isNew) {
          // Workspace skeleton — real subfolders from day one (see
          // docs/OBSIDIAN_VAULT_SETUP.md), not created lazily by whichever
          // chunk happens to touch them first.
          await Promise.all(
            ["notes", "canvases", "workflows", "assets"].map((sub) => obsidian.mkdirp(obsidian.dirs.projects, `${relPath}/${sub}`))
          );
        }
        sendJson(res, 200, { ok: true, data: { ...project, id: relPath, archived: false, createdAt: record.createdAt, updatedAt: record.updatedAt } });
      });

      const projectArchiveRoute = (archiving) => async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "POST only" });
          return;
        }
        if (!obsidian.configured) {
          sendJson(res, 501, { ok: false, error: "Obsidian vault not configured" });
          return;
        }
        let body;
        try {
          body = JSON.parse((await readBody(req)) || "{}");
        } catch {
          sendJson(res, 400, { ok: false, error: "invalid JSON body" });
          return;
        }
        const relPath = safeRelPath(body.id);
        if (!relPath) {
          sendJson(res, 400, { ok: false, error: "invalid path" });
          return;
        }
        const [fromDir, toDir] = archiving ? [obsidian.dirs.projects, obsidian.dirs.archive] : [obsidian.dirs.archive, obsidian.dirs.projects];
        const result = await obsidian.move(fromDir, relPath, toDir, relPath);
        sendJson(res, result.ok ? 200 : 502, result);
      };
      use("/local/obsidian/projects/archive", projectArchiveRoute(true));
      use("/local/obsidian/projects/unarchive", projectArchiveRoute(false));

      // ---- Canvases: JSON files inside a project's canvases/ subfolder,
      // not Obsidian desktop .canvas — Marco doesn't work in Obsidian
      // desktop, so this is a custom format the UI owns end to end.
      use("/local/obsidian/canvases/list", async (req, res) => {
        if (!obsidian.configured) {
          sendJson(res, 200, { ok: true, data: [] });
          return;
        }
        const q = new URL(req.url, "http://x").searchParams;
        const projectRel = safeRelPath(q.get("project") || "");
        if (!projectRel) {
          sendJson(res, 400, { ok: false, error: "invalid project" });
          return;
        }
        const dir = `${obsidian.dirs.projects}/${projectRel}/canvases`;
        const result = await obsidian.listFiles(dir, "flat-json");
        if (!result.ok) {
          sendJson(res, 502, result);
          return;
        }
        const data = result.files.map((f) => {
          try {
            return { ...JSON.parse(f.raw), id: f.relPath };
          } catch {
            return { id: f.relPath, name: f.relPath, error: "invalid JSON in file", version: 1, type: "hermes-project-canvas", nodes: [], edges: [] };
          }
        });
        sendJson(res, 200, { ok: true, data });
      });

      use("/local/obsidian/canvases/write", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "POST only" });
          return;
        }
        if (!obsidian.configured) {
          sendJson(res, 501, { ok: false, error: "Obsidian vault not configured" });
          return;
        }
        let body;
        try {
          body = JSON.parse((await readBody(req)) || "{}");
        } catch {
          sendJson(res, 400, { ok: false, error: "invalid JSON body" });
          return;
        }
        const projectRel = safeRelPath(body.project || "");
        if (!projectRel) {
          sendJson(res, 400, { ok: false, error: "invalid project" });
          return;
        }
        const dir = `${obsidian.dirs.projects}/${projectRel}/canvases`;
        const canvas = body.canvas || {};
        let relPath = body.id ? safeRelPath(body.id) : null;
        if (body.id && !relPath) {
          sendJson(res, 400, { ok: false, error: "invalid path" });
          return;
        }
        if (!relPath) {
          const base = safeFileName(canvas.name);
          let candidate = `${base}.canvas.json`;
          for (let n = 2; await obsidian.exists(dir, candidate); n++) {
            if (n > 200) {
              sendJson(res, 500, { ok: false, error: "could not find a free filename" });
              return;
            }
            candidate = `${base} (${n}).canvas.json`;
          }
          relPath = candidate;
        }
        const record = {
          version: 1,
          type: "hermes-project-canvas",
          name: canvas.name || "Untitled canvas",
          description: canvas.description || "",
          tags: canvas.tags || [],
          nodes: canvas.nodes || [],
          edges: canvas.edges || [],
        };
        const result = await obsidian.writeFile(dir, relPath, JSON.stringify(record, null, 2));
        if (!result.ok) {
          sendJson(res, 502, result);
          return;
        }
        sendJson(res, 200, { ok: true, data: { ...record, id: relPath } });
      });

      use("/local/obsidian/canvases/archive", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "POST only" });
          return;
        }
        if (!obsidian.configured) {
          sendJson(res, 501, { ok: false, error: "Obsidian vault not configured" });
          return;
        }
        let body;
        try {
          body = JSON.parse((await readBody(req)) || "{}");
        } catch {
          sendJson(res, 400, { ok: false, error: "invalid JSON body" });
          return;
        }
        const projectRel = safeRelPath(body.project || "");
        const relPath = safeRelPath(body.id || "");
        if (!projectRel || !relPath) {
          sendJson(res, 400, { ok: false, error: "invalid path" });
          return;
        }
        const fromDir = `${obsidian.dirs.projects}/${projectRel}/canvases`;
        const toDir = `${obsidian.dirs.archive}/${projectRel}/canvases`;
        const result = await obsidian.move(fromDir, relPath, toDir, relPath);
        sendJson(res, result.ok ? 200 : 502, result);
      });

      // ---- Workflows: JSON files inside a project's workflows/ subfolder,
      // same shape as canvases above (one project sub-resource kind, same
      // filesystem contract).
      use("/local/obsidian/workflows/list", async (req, res) => {
        if (!obsidian.configured) {
          sendJson(res, 200, { ok: true, data: [] });
          return;
        }
        const q = new URL(req.url, "http://x").searchParams;
        const projectRel = safeRelPath(q.get("project") || "");
        if (!projectRel) {
          sendJson(res, 400, { ok: false, error: "invalid project" });
          return;
        }
        const dir = `${obsidian.dirs.projects}/${projectRel}/workflows`;
        const result = await obsidian.listFiles(dir, "flat-json");
        if (!result.ok) {
          sendJson(res, 502, result);
          return;
        }
        const data = result.files.map((f) => {
          try {
            return { ...JSON.parse(f.raw), id: f.relPath };
          } catch {
            return { id: f.relPath, name: f.relPath, error: "invalid JSON in file", version: 1, type: "hermes-project-workflow", steps: [] };
          }
        });
        sendJson(res, 200, { ok: true, data });
      });

      use("/local/obsidian/workflows/write", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "POST only" });
          return;
        }
        if (!obsidian.configured) {
          sendJson(res, 501, { ok: false, error: "Obsidian vault not configured" });
          return;
        }
        let body;
        try {
          body = JSON.parse((await readBody(req)) || "{}");
        } catch {
          sendJson(res, 400, { ok: false, error: "invalid JSON body" });
          return;
        }
        const projectRel = safeRelPath(body.project || "");
        if (!projectRel) {
          sendJson(res, 400, { ok: false, error: "invalid project" });
          return;
        }
        const dir = `${obsidian.dirs.projects}/${projectRel}/workflows`;
        const workflow = body.workflow || {};
        let relPath = body.id ? safeRelPath(body.id) : null;
        if (body.id && !relPath) {
          sendJson(res, 400, { ok: false, error: "invalid path" });
          return;
        }
        if (!relPath) {
          const base = safeFileName(workflow.name);
          let candidate = `${base}.workflow.json`;
          for (let n = 2; await obsidian.exists(dir, candidate); n++) {
            if (n > 200) {
              sendJson(res, 500, { ok: false, error: "could not find a free filename" });
              return;
            }
            candidate = `${base} (${n}).workflow.json`;
          }
          relPath = candidate;
        }
        const record = {
          version: 1,
          type: "hermes-project-workflow",
          name: workflow.name || "Untitled workflow",
          description: workflow.description || "",
          tags: workflow.tags || [],
          status: workflow.status || "draft",
          steps: workflow.steps || [],
        };
        const result = await obsidian.writeFile(dir, relPath, JSON.stringify(record, null, 2));
        if (!result.ok) {
          sendJson(res, 502, result);
          return;
        }
        sendJson(res, 200, { ok: true, data: { ...record, id: relPath } });
      });

      use("/local/obsidian/workflows/archive", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { ok: false, error: "POST only" });
          return;
        }
        if (!obsidian.configured) {
          sendJson(res, 501, { ok: false, error: "Obsidian vault not configured" });
          return;
        }
        let body;
        try {
          body = JSON.parse((await readBody(req)) || "{}");
        } catch {
          sendJson(res, 400, { ok: false, error: "invalid JSON body" });
          return;
        }
        const projectRel = safeRelPath(body.project || "");
        const relPath = safeRelPath(body.id || "");
        if (!projectRel || !relPath) {
          sendJson(res, 400, { ok: false, error: "invalid path" });
          return;
        }
        const fromDir = `${obsidian.dirs.projects}/${projectRel}/workflows`;
        const toDir = `${obsidian.dirs.archive}/${projectRel}/workflows`;
        const result = await obsidian.move(fromDir, relPath, toDir, relPath);
        sendJson(res, result.ok ? 200 : 502, result);
      });
    },
  };
}
