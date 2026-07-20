# Hermes Custom UI — Bridge Implementation Plan

## Objective

Build a clean server-side bridge for Marco's custom Hermes UI so the React frontend can progressively display real Hermes data:

- gateway health
- detailed status
- capabilities
- skills
- toolsets/tools
- sessions
- jobs/cron
- model status/options
- model switching
- future dashboard/admin data

The final architecture must allow adding more Hermes data over time without coupling React components directly to random Hermes endpoints.

---

## Core Principle

React must **not** know whether a datum comes from:

- Hermes Gateway API `:8642`
- Hermes Dashboard/WebUI `:9119`
- CLI fallback
- config files
- future Hermes endpoints

React should only call local normalized endpoints:

```txt
/local/hermes/health
/local/hermes/health/detailed
/local/hermes/capabilities
/local/hermes/skills
/local/hermes/toolsets
/local/hermes/sessions
/local/hermes/jobs
/local/hermes/models
/local/hermes/model/set
/local/hermes/dashboard/status
```

The bridge gets dirty. The UI stays clean.

---

## Existing Project State

Current stack:

```txt
React 19
Vite
Framer Motion
Hermes Gateway API via /gw proxy
Dashboard model bridge via vite-plugins/hermesDashboard.js
```

Important existing files:

```txt
src/config.js
src/lib/gatewayRuns.js
src/lib/dashboard.js
src/state/Chat.jsx
src/hooks/useGatewayHealth.js
src/components/chat/ModelSelector.jsx
vite-plugins/hermesDashboard.js
vite.config.js
```

Current strengths:

- Chat already uses Hermes Runs API.
- SSE streaming is already implemented.
- Tool events are already parsed.
- `/health/detailed` is already polled.
- Model switching exists, but is currently too narrow and hardcoded.

Current problems:

- Model list is hardcoded in `src/data/hermesModels.js`.
- Slash command list is empty.
- Dashboard data is not normalized.
- Frontend uses `VITE_GATEWAY_API_KEY`, acceptable for local dev but not production.
- Vite proxy only works in development.
- There is no unified Hermes data bridge.

---

## Backend Sources

### 1. Hermes Gateway API

Base URL example:

```txt
http://192.168.2.11:8642
```

Use for stable API data:

```txt
GET /health
GET /health/detailed
GET /v1/capabilities
GET /v1/skills
GET /v1/toolsets
GET /api/sessions
GET /api/jobs
POST /v1/runs
GET /v1/runs/{id}
GET /v1/runs/{id}/events
POST /v1/runs/{id}/stop
```

Auth:

```txt
Authorization: Bearer <API_SERVER_KEY>
```

Do not expose the real key in the browser bundle.

---

### 2. Hermes Dashboard/WebUI

Base URL example:

```txt
http://192.168.2.11:9119
```

Use for admin/dashboard data and model switching.

Known existing route in project:

```txt
POST /api/default-model
```

Auth flow currently used by `vite-plugins/hermesDashboard.js`:

```txt
POST /auth/password-login
```

Credentials must remain server-side only:

```txt
HERMES_DASHBOARD_BASE_URL
HERMES_DASHBOARD_USERNAME
HERMES_DASHBOARD_PASSWORD
```

Never expose dashboard username/password in browser code.

---

## Required Implementation

### Step 1 — Create a unified Vite bridge plugin

Create:

```txt
vite-plugins/hermesBridge.js
```

It should replace or wrap the current dashboard-only model bridge.

The plugin should accept:

```js
hermesBridgePlugin({
  gatewayBaseUrl,
  gatewayApiKey,
  dashboardBaseUrl,
  dashboardUsername,
  dashboardPassword,
})
```

Expose local endpoints:

```txt
GET  /local/hermes/health
GET  /local/hermes/health/detailed
GET  /local/hermes/capabilities
GET  /local/hermes/skills
GET  /local/hermes/toolsets
GET  /local/hermes/sessions
GET  /local/hermes/jobs
GET  /local/hermes/models
POST /local/hermes/model/set
GET  /local/hermes/dashboard/status
```

The plugin must normalize response shapes.

---

### Step 2 — Gateway proxy helpers

Inside `hermesBridge.js`, implement a helper similar to:

```js
async function gatewayFetch(path, init = {}) {
  return fetch(`${gatewayBaseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${gatewayApiKey}`,
    },
  });
}
```

For public health:

```txt
GET /health
```

Bearer is optional, but it is fine to include it.

For detailed health and all `/v1` or `/api` routes, use bearer auth.

---

### Step 3 — Dashboard auth helper

Reuse the current login/cookie pattern from:

```txt
vite-plugins/hermesDashboard.js
```

Keep:

```txt
POST /auth/password-login
```

Cache session cookie in memory.

Re-login on:

```txt
401
302
```

Do not expose cookie, username, or password to browser.

---

### Step 4 — Implement normalized endpoint: models

`GET /local/hermes/models` should return a normalized shape:

```json
{
  "configured": true,
  "source": "dashboard",
  "current": {
    "provider": "openai-codex",
    "model": "gpt-5.5",
    "label": "gpt-5.5"
  },
  "options": [
    {
      "provider": "openai-codex",
      "model": "gpt-5.5",
      "label": "gpt-5.5",
      "available": true
    }
  ],
  "auxiliary": [],
  "warning": null
}
```

Implementation strategy:

1. First try documented/new dashboard endpoints if available:
   - `GET /api/model/options`
   - `GET /api/model/auxiliary`
2. If they fail, fallback to current project static list from:
   - `src/data/hermesModels.js`
3. The fallback response must explicitly say:

```json
{
  "source": "static-fallback",
  "warning": "Dashboard model options endpoint unavailable; using static model list."
}
```

Do not pretend fallback data is authoritative.

---

### Step 5 — Implement normalized endpoint: model set

`POST /local/hermes/model/set`

Body:

```json
{
  "provider": "openai-codex",
  "model": "gpt-5.5"
}
```

The bridge should:

1. Prefer dashboard model set endpoint:
   - `POST /api/default-model`
2. If newer dashboard endpoint exists, support:
   - `POST /api/model/set`
3. Return normalized response:

```json
{
  "ok": true,
  "scope": "global",
  "provider": "openai-codex",
  "model": "gpt-5.5",
  "message": "Global Hermes model updated."
}
```

Important UI warning:

Model switching is **global**. It affects:

```txt
Custom UI
Telegram
Discord
WhatsApp
every Hermes gateway platform
```

Not just the current chat.

---

### Step 6 — Create frontend bridge client

Create:

```txt
src/lib/hermesBridge.js
```

Exports:

```js
export async function fetchHermesHealth()
export async function fetchHermesDetailedHealth()
export async function fetchHermesCapabilities()
export async function fetchHermesSkills()
export async function fetchHermesToolsets()
export async function fetchHermesSessions()
export async function fetchHermesJobs()
export async function fetchHermesModels()
export async function setHermesModel({ provider, model })
```

All functions call `/local/hermes/*`, never remote Hermes directly.

---

### Step 7 — Refactor ModelSelector

Update:

```txt
src/components/chat/ModelSelector.jsx
```

Current behavior:

- imports static `HERMES_MODELS`
- calls `setDashboardModel`

New behavior:

- loads model data via `fetchHermesModels()`
- displays `models.options`
- shows source badge:
  - `dashboard`
  - `static-fallback`
  - `unavailable`
- calls `setHermesModel({ provider, model })`
- updates local active model label only after successful response
- shows warning: `Global model change`

Keep a fallback to `HERMES_MODELS` only if bridge data is unavailable.

---

### Step 8 — Add System/Data Panel progressively

Create later, or stub now:

```txt
src/components/chat/SystemPanel.jsx
src/components/chat/SystemPanel.css
```

It should eventually display:

```txt
Gateway
Capabilities
Skills
Toolsets
Sessions
Jobs
Models
MCP, when available
```

Initial data sources:

```txt
GET /local/hermes/capabilities
GET /local/hermes/skills
GET /local/hermes/toolsets
GET /local/hermes/jobs
GET /local/hermes/health/detailed
```

UI direction:

- dark
- compact
- teal accents
- technical labels
- no big SaaS cards
- no fake data

---

## Acceptance Criteria

The implementation is successful when:

1. `npm run build` passes.
2. Existing chat still works.
3. Gateway health still works.
4. Model selector no longer depends only on static `HERMES_MODELS`.
5. Model switching still works through dashboard bridge.
6. Skills are retrievable from:

```txt
/local/hermes/skills
```

7. Toolsets are retrievable from:

```txt
/local/hermes/toolsets
```

8. Capabilities are retrievable from:

```txt
/local/hermes/capabilities
```

9. If dashboard model endpoints fail, UI shows fallback honestly.
10. Dashboard credentials never appear in client bundle.

---

## Security Rules

Never expose these in frontend code:

```txt
API_SERVER_KEY
HERMES_DASHBOARD_USERNAME
HERMES_DASHBOARD_PASSWORD
dashboard session cookie
```

Current `VITE_GATEWAY_API_KEY` is acceptable only for local dev.

For production, the final architecture should be:

```txt
React UI
  -> server-side bridge/proxy
  -> Hermes Gateway API + Dashboard API
```

Also avoid logging secrets from request headers, environment variables, dashboard login responses, or cookies.

---

## Suggested Branch and Commit

```bash
git checkout -b feat/hermes-ui-bridge
git add .
git commit -m "feat: add Hermes UI bridge implementation"
git push -u origin feat/hermes-ui-bridge
```

If this file is committed alone, use:

```bash
git checkout -b docs/hermes-ui-bridge-plan
git add docs/HERMES_UI_BRIDGE_IMPLEMENTATION.md
git commit -m "docs: add Hermes UI bridge implementation plan"
git push -u origin docs/hermes-ui-bridge-plan
```

---

## Notes for Claude

Do not overcomplicate this.

The first goal is not to perfectly clone the built-in dashboard.

The first goal is to create a stable bridge layer so Marco's custom UI can progressively add real Hermes data.

Avoid random endpoint guessing inside React components.

All probing/fallback logic belongs server-side in the bridge.

React components should consume normalized data only.

No fake data. No hardcoded secrets. No client-side dashboard credentials.
