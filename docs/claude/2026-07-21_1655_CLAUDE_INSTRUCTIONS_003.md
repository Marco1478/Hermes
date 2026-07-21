# Claude Instructions 003 — Kanban, Command Parity, Agent Control Center

## Operating Rules

- Work chunks in numeric order unless a chunk is blocked and a later chunk is independent.
- Before moving to the next chunk, verify the current chunk with every listed gate.
- Commit locally after each verified chunk.
- Do **not** push after individual chunks.
- Push to GitHub **once only**, after reaching the end of this full instruction file.
- If blocked by missing backend/API support, do not fake the feature. Add a precise blocker note under `docs/claude/status/`, commit it, and continue with the next independent chunk.
- Never commit secrets, tokens, passwords, cookies, API keys, or connection strings. Use `[REDACTED]` in reports.
- Keep `.env.local` local and git-ignored.
- Final report must be very brief: what shipped, what was verified, what remains blocked.

## Current verified backend context

Hermes has real backend connectivity from the UI environment now.

Known working services:

- Gateway: `VITE_GATEWAY_BASE_URL` is configured locally.
- Gateway API key: configured locally, never print it.
- Dashboard: `HERMES_DASHBOARD_BASE_URL` is configured locally.
- Dashboard auth: username/password configured locally, never print them.
- Docker access from Hermes container works.
- `npm run build` passes.
- Real backend smoke previously passed: gateway health, detailed health, models, sessions, runs, dashboard auth, cron jobs, memory node edit no-op, toolset no-op toggle.

Known UI issue to fix first:

- System Overview contains live cards below the viewport, but page/document scroll height stays equal to viewport height. Content around Recent Sessions is clipped and not reachable by normal scroll. Fix this before adding new dense surfaces.

---

## CLAUDE-001 — Stabilize layout foundations and System Overview scroll

**Objective:**
Fix the existing System Overview scroll/container bug before building larger control surfaces.

**Files likely involved:**

- `src/App.jsx`
- `src/components/PageShell.jsx`
- `src/components/PageShell.css`
- `src/components/system/SystemOverviewPage.jsx`
- `src/components/system/SystemOverviewPage.css`
- global layout files under `src/styles/`

**Implementation notes:**

- Audit all root/page wrappers for `height: 100vh`, `overflow: hidden`, fixed containers, and absolute layers that collapse document height.
- Dense operational pages must scroll naturally.
- Preserve hero cinematic behavior, but do not let hero constraints leak into System/Hermes/Jobs/Tools/Kanban pages.
- Test at desktop viewport around `1280x720`; content below fold must be reachable.

**Verification gate:**

- `npm run build` passes.
- Browser opens System Overview with real or diagnostic data.
- Run in browser console:
  - `document.documentElement.scrollHeight > window.innerHeight` when content exceeds viewport.
  - lower cards are reachable by scrolling.
- No overlap in header/nav/content.
- Browser console has no JS errors.

**Commit rule:**

Commit locally when verified:

```bash
git commit -m "fix: restore scrolling for dense control pages"
```

---

## CLAUDE-002 — Add Kanban backend bridge, no fake local board

**Objective:**
Create a real Kanban bridge layer connected to Hermes Kanban capabilities. This must not be a localStorage toy.

**Files likely involved:**

- `vite-plugins/hermesBridge.js`
- `src/lib/hermesBridge.js`
- new `src/lib/kanbanBridge.js` if useful
- route/state files under `src/state/`
- diagnostics component if needed

**Implementation notes:**

Hermes supports Kanban through CLI verbs such as:

```text
hermes kanban init
hermes kanban create
hermes kanban list
hermes kanban show
hermes kanban assign
hermes kanban link
hermes kanban unlink
hermes kanban comment
hermes kanban complete
hermes kanban block
hermes kanban unblock
hermes kanban archive
hermes kanban tail
hermes kanban stats
hermes kanban runs
hermes kanban log
```

Implement bridge endpoints that either:

1. call official dashboard/API endpoints if they exist; or
2. safely call Hermes CLI from the server-side Vite bridge and parse JSON/text output.

Required bridge capabilities:

- list tasks/boards
- show task detail
- create task
- assign task
- block task
- unblock task
- complete task
- add comment
- link/unlink branch, commit, PR, file, instruction document
- tail task event log if available
- expose a clean `available: true/false` diagnostic state

No endpoint should expose secrets. Command execution must sanitize input and avoid shell injection.

If the installed Hermes version cannot expose Kanban via API/CLI in this environment, create a blocker report:

```text
docs/claude/status/2026-07-21_kanban_backend_blocker.md
```

and still build the UI around a diagnostic state, not fake sample cards.

**Verification gate:**

- Backend bridge endpoints return JSON.
- If Kanban is available, create one reversible test task named `HERMES_UI_KANBAN_TEST_DELETE_ME`, read it, comment on it, block/unblock it, complete or archive it, and verify cleanup.
- If unavailable, diagnostic response explains exactly which command/endpoint failed.
- Security scan: no API key/token/password/cookie committed.
- `npm run build` passes.

**Commit rule:**

Commit locally when verified:

```bash
git commit -m "feat: add Hermes kanban bridge"
```

---

## CLAUDE-003 — Build grand Hermes Kanban tab

**Objective:**
Add a new top-level `kanban` tab that becomes Marco's operational work queue for Hermes, Claude, GitHub, cron briefs, blockers, and review loops.

**Files likely involved:**

- `src/App.jsx`
- `src/state/ViewMode.jsx`
- `src/components/PageShell.jsx`
- new `src/components/kanban/KanbanPage.jsx`
- new `src/components/kanban/KanbanPage.css`
- new `src/components/kanban/KanbanCard.jsx`
- new `src/components/kanban/KanbanDetailDrawer.jsx`
- shared UI primitives if useful

**Design direction:**

This must feel like a Hermes mission board, not Trello pasted into a dark theme.

Use columns:

```text
BACKLOG
READY
IN PROGRESS
BLOCKED
REVIEW
DONE
```

Card hierarchy:

- title
- owner: Marco / Hermes / Claude / agent/profile
- status
- priority
- linked instruction chunk, e.g. `CLAUDE-003`
- branch/commit/PR link if available
- verification state
- blocker reason
- last event timestamp

Detail drawer:

- full description
- comments
- event log
- linked files
- linked GitHub branch/commit/PR
- action buttons
- verification checklist

Aesthetic requirements:

- dark cinematic/technical Hermes identity
- teal/cyan accent language
- strong column headers
- blocked cards must be visually unmistakable
- review/done cards must be calm and readable
- no tiny illegible text
- desktop-first, responsive fallback
- no horizontal chaos; if horizontal scroll is needed, make it intentional and polished

**Verification gate:**

- `kanban` appears in header nav with same quality as existing tabs.
- Empty/unavailable state is beautiful and precise.
- Real data state renders without layout collapse.
- Detail drawer opens/closes correctly.
- Actions show success/error states.
- Browser QA at `1280x720` and wider.
- Console has no JS errors.
- `npm run build` passes.

**Commit rule:**

Commit locally when verified:

```bash
git commit -m "feat: add Hermes kanban mission board"
```

---

## CLAUDE-004 — Add Kanban write actions and task-to-agent workflow

**Objective:**
Make Kanban operational, not read-only wallpaper.

**Required actions:**

- create task
- assign task to Hermes/Claude/Marco/profile
- block/unblock with reason
- complete/archive
- add comment
- link to branch/commit/PR/instruction file
- create tasks from selected Claude instruction chunks if feasible

**Workflow expectations:**

A Claude instruction file should map naturally into cards:

```text
CLAUDE-001 → card
CLAUDE-002 → card
CLAUDE-003 → card
```

A Hermes review should map naturally into:

```text
REVIEW — verify Claude work
BLOCKED — user decision needed
NEXT — draft next instruction file
```

If full automation is not possible, provide a precise partial implementation and blocker note.

**Verification gate:**

- Use one reversible test task.
- Exercise create → assign → comment → block → unblock → complete/archive.
- Verify final cleanup or archived state.
- UI updates after each action without full page reload if practical.
- Error states are shown inline, not swallowed.
- `npm run build` passes.

**Commit rule:**

Commit locally when verified:

```bash
git commit -m "feat: enable kanban task actions"
```

---

## CLAUDE-005 — Command Palette: replicate Telegram slash commands inside custom UI

**Objective:**
Create a command surface in the custom UI that exposes the same operational commands Marco can use from Telegram, with real backend execution where supported.

**Files likely involved:**

- `vite-plugins/hermesBridge.js`
- `src/lib/hermesBridge.js`
- new `src/components/commands/CommandPalette.jsx`
- new `src/components/commands/CommandPalette.css`
- command registry/config files if useful
- header/global shortcut files

**Command categories to support:**

Session control:

```text
/new
/reset
/retry
/undo
/title
/compress
/stop
/background
/queue
/steer
/agents
/resume
/goal
```

Configuration:

```text
/model
/personality
/reasoning
/verbose
/voice
/yolo
/footer
/statusbar
```

Tools and skills:

```text
/tools
/toolsets
/skills
/skill
/reload-skills
/reload
/reload-mcp
/cron
/curator
/kanban
/plugins
```

Gateway:

```text
/approve
/deny
/restart
/sethome
/update
/topic
/platforms
/gateway
```

Utility/info:

```text
/branch
/fork
/handoff
/fast
/browser
/history
/save
/copy
/paste
/image
/help
/commands
/usage
/insights
/status
/profile
/debug
```

Exit:

```text
/quit
/exit
/q
```

**Implementation notes:**

- Prefer deriving the command registry from Hermes itself if an API/CLI source exists, rather than hardcoding forever.
- If deriving dynamically is not available, create a local metadata registry with a clear TODO/blocker explaining how to switch to dynamic registry later.
- Every command card should include:
  - command
  - aliases
  - category
  - description
  - parameter hint
  - surface support: UI / Telegram / CLI / gateway-only
  - risk level: safe / state-changing / dangerous
  - execution status: available / unsupported / requires backend endpoint
- Execute safe observable commands first:
  - `/help`
  - `/commands`
  - `/status`
  - `/usage`
  - `/platforms`
  - `/profile`
  - `/model` read mode
  - `/tools` read mode
  - `/skills` read mode
  - `/cron` read mode
  - `/kanban` read/list mode
- State-changing commands must require confirmation.
- Dangerous commands such as `/restart`, `/update`, destructive delete/remove operations, and approval commands need modal confirmation with exact impact text.

**Verification gate:**

- Command Palette opens from header button and keyboard shortcut, preferably `Ctrl/Cmd+K`.
- Search/filter works.
- Safe read commands execute and return visible output.
- Unsupported commands show precise diagnostics, not fake success.
- Dangerous commands show confirmation before execution.
- Browser console has no JS errors.
- `npm run build` passes.

**Commit rule:**

Commit locally when verified:

```bash
git commit -m "feat: add Hermes command palette"
```

---

## CLAUDE-006 — Agent Activity Center

**Objective:**
Add a high-signal activity timeline showing what Hermes, Claude, cron, GitHub, and Kanban are doing.

**Files likely involved:**

- new `src/components/activity/ActivityCenter.jsx`
- new `src/components/activity/ActivityCenter.css`
- `src/components/system/SystemOverviewPage.jsx`
- `vite-plugins/hermesBridge.js`
- `src/lib/hermesBridge.js`

**Data sources:**

Use real sources where available:

- recent sessions
- gateway runs
- cron job last runs
- Kanban event log
- Git commits from repo if bridge can safely expose them
- Claude status reports under `docs/claude/status/`

Do not fabricate fake timeline events. If a source is unavailable, show a diagnostic.

**UI requirements:**

- timeline cards with timestamp, actor, source, status
- filters: Hermes / Claude / Cron / GitHub / Kanban / Blockers
- status colors: success, running, blocked, failed, info
- compact summary card for System Overview
- richer detail view inside Kanban or dedicated activity area

**Verification gate:**

- Activity renders at least real sessions/cron data if available.
- No fake hardcoded demo events.
- Empty state is explicit.
- `npm run build` passes.
- Browser QA confirms timeline readability.

**Commit rule:**

Commit locally when verified:

```bash
git commit -m "feat: add agent activity center"
```

---

## CLAUDE-007 — Approval and Safety Center

**Objective:**
Create a UI surface for pending approvals and dangerous actions, mirroring Telegram-side `/approve` and `/deny` behavior where backend support exists.

**Files likely involved:**

- new `src/components/safety/SafetyCenter.jsx`
- new `src/components/safety/SafetyCenter.css`
- `src/components/system/SystemOverviewPage.jsx`
- `vite-plugins/hermesBridge.js`
- `src/lib/hermesBridge.js`

**Implementation notes:**

- Discover whether Hermes exposes pending approvals through API, CLI, state DB, or logs.
- If available, show pending approvals with:
  - requester/session
  - command/action
  - risk level
  - timestamp
  - approve/deny controls
- If unavailable, show diagnostic explaining exact missing backend surface.
- Dangerous UI actions elsewhere should use a shared confirmation component.

**Verification gate:**

- Approval Center renders available/unavailable state clearly.
- If pending approval API exists, approve/deny calls work on a reversible test or documented safe case.
- If not available, blocker note is committed.
- Shared dangerous-action confirmation is used by restart/delete/toggle where applicable.
- `npm run build` passes.

**Commit rule:**

Commit locally when verified:

```bash
git commit -m "feat: add approval safety center"
```

---

## CLAUDE-008 — Claude Mission Pipeline

**Objective:**
Create a UI model that links instruction files, chunks, commits, reports, Hermes reviews, blockers, and next suggested instruction packs.

**Files likely involved:**

- new `src/components/missions/MissionPipeline.jsx`
- new `src/components/missions/MissionPipeline.css`
- `vite-plugins/hermesBridge.js`
- `src/lib/hermesBridge.js`
- `docs/claude/` parsing utilities if needed

**Implementation notes:**

Parse real files from:

```text
docs/claude/*CLAUDE_INSTRUCTIONS_*.md
docs/claude/status/*.md
```

Expose:

- instruction file list
- chunks: `CLAUDE-001`, `CLAUDE-002`, etc.
- chunk titles/objectives
- reported status if inferable
- linked commits if inferable from git log/status reports
- blockers from status docs
- next instruction proposal placeholder

Connect to Kanban where possible:

- create board cards from instruction chunks
- link status report to cards
- show review state

Do not pretend to know task status unless it is found in files, Kanban, or git metadata.

**Verification gate:**

- Existing instruction files 001 and 002 are discovered.
- Current status reports are discovered.
- At least chunk titles/objectives render correctly.
- Unknown status is displayed as unknown, not done.
- Links to files work inside UI where possible.
- `npm run build` passes.

**Commit rule:**

Commit locally when verified:

```bash
git commit -m "feat: add Claude mission pipeline"
```

---

## CLAUDE-009 — Backend Test Center and permanent smoke script

**Objective:**
Add a persistent, reviewable test surface and npm script so Hermes can verify the custom UI automatically in future reviews.

**Files likely involved:**

- `package.json`
- new `scripts/smoke-backend.mjs` or `scripts/smoke-ui.mjs`
- `vite-plugins/hermesBridge.js`
- new `src/components/testing/BackendTestCenter.jsx`
- new CSS file if needed
- System Overview integration

**Required npm script:**

```json
"smoke": "node scripts/smoke-backend.mjs"
```

or equivalent.

**Smoke test must cover:**

- environment variable presence without printing secret values
- gateway health
- dashboard auth
- model options/read state
- cron jobs read
- reversible cron job create/delete using `HERMES_UI_TEST_DELETE_ME`
- memory read and no-op edit if safe
- toolsets read and no-op toggle if safe
- Kanban availability/read test
- command registry availability
- System Overview scroll regression check if using browser/Playwright, or at least DOM/layout test if feasible

If full browser automation is not practical without new dependencies, implement backend smoke first and document browser smoke as next step. Do not delete this test before pushing. This must become permanent repo infrastructure.

**Backend Test Center UI:**

- Button: run backend smoke
- Display last result: passed/failed count
- Show endpoint groups
- Show cleanup status
- Redact secrets
- Link to generated local report if available

**Verification gate:**

- `npm run smoke` exists and runs.
- `npm run smoke` passes in configured local environment or reports precise missing env in unconfigured mode.
- `npm run build` passes.
- No secrets printed.
- Browser QA confirms test center is readable.

**Commit rule:**

Commit locally when verified:

```bash
git commit -m "test: add Hermes backend smoke checks"
```

---

## CLAUDE-010 — File Vault / attachment support diagnostics

**Objective:**
Improve the file attach experience with explicit support states instead of mysterious partial behavior.

**Files likely involved:**

- `src/components/chat/ChatInput.jsx`
- `src/state/Chat.jsx`
- new `src/components/files/FileVault.jsx`
- new CSS file if needed
- bridge files if backend upload diagnostics exist

**Implementation notes:**

Show file support by class:

- images: supported if current gateway/chat path supports them
- text/code/markdown/json: supported
- PDF: unsupported unless parser/gateway path exists
- DOC/DOCX: unsupported unless parser/gateway path exists
- binary: blocked by default

For unsupported files, show exactly why:

```text
PDF parser missing
Gateway file_input unsupported
MIME type blocked
Size limit exceeded
```

If feasible, add local client-side text preview for text/code files before send.

**Verification gate:**

- Supported file accept list is visible and correct.
- Unsupported types show precise message.
- No fake “uploaded” state unless backend accepted the file.
- `npm run build` passes.

**Commit rule:**

Commit locally when verified:

```bash
git commit -m "feat: add file attachment diagnostics"
```

---

## CLAUDE-011 — Memory Studio foundation

**Objective:**
Upgrade memory management from a flat list into a safer operational studio.

**Files likely involved:**

- `src/components/hermes/MemoryDetailDrawer.jsx`
- new `src/components/memory/MemoryStudio.jsx`
- bridge files if needed

**Implementation notes:**

Show:

- user profile memory
- operational memory
- capacity/fullness
- edit/delete actions already supported
- create memory only if real backend endpoint exists
- conflict/duplicate hints if inferable
- “convert workflow into skill” as diagnostic/future action unless backend exists

Do not add fake memory creation. If backend lacks create endpoint, keep create disabled with exact explanation.

**Verification gate:**

- Existing memories render.
- Edit/delete behavior remains safe.
- Create is either real and tested or disabled with diagnostic.
- No secret exposure.
- `npm run build` passes.

**Commit rule:**

Commit locally when verified:

```bash
git commit -m "feat: add memory studio foundation"
```

---

## CLAUDE-012 — Final integration polish, visual QA, security scan, and final push

**Objective:**
Consolidate the entire option-3 control-center upgrade into a stable final branch/main state.

**Required final checks:**

- `git status --short --branch`
- `npm run build`
- `npm run smoke` if implemented
- browser QA for:
  - hero
  - chat
  - hermes
  - jobs
  - tools
  - system
  - kanban
  - command palette
  - activity/safety/mission surfaces
- browser console check: no JS errors
- secret scan over diff:
  - no tokens
  - no API keys
  - no cookies
  - no dashboard password
  - no `.env.local`
- verify System Overview scroll remains fixed
- verify no fake/local-only success states for backend-backed features

**Final report:**

Create a very brief report:

```text
docs/claude/status/2026-07-21_option3_control_center_report.md
```

Keep it short:

- shipped
- verified
- blocked
- final commit/push note

**Final push rule:**

Only after the full instruction file has been attempted through the end:

```bash
git push origin main
```

or push the current working branch if the repo workflow has changed. Do not push multiple times throughout the file.

**Commit rule:**

Final commit if needed:

```bash
git commit -m "docs: add option 3 control center implementation report"
```

Then push once.
