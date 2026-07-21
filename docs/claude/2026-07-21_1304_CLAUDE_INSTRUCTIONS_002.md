# Claude Instructions — Real System Overview and Backend Controls

## Context from Marco/Hermes

Marco reviewed the latest UI pass and wants the next phase to move from visual shell to **real operational command center**.

Current direction:

- Keep the hero clean and cinematic.
- Move the large `System overview` out of the hero into its own tab/page.
- Keep a small always-visible usage overview in the hero.
- Restore usage circles/rings.
- All new features must work against the real Hermes backend/bridge. No fake UI, no hardcoded mock data.

Important: **do not expand or stuff `SOUL.md` further.** Marco said it is full. Improve the UI, bridge, controls, memory editor and operational pages instead.

## Operating Rules

- Work chunks in numeric order unless blocked and a later chunk is independent.
- Verify each chunk before moving on.
- Commit autonomously after each verified chunk.
- If blocked by missing backend endpoints/config/user input, commit a blocker note under `docs/claude/status/` explaining exactly what endpoint/config is missing, then continue to the next independent chunk.
- Do not expose secrets, tokens, API keys, passwords, env values, or private credentials.
- Do not implement fake interactions. If a backend endpoint does not exist, add the real bridge route where feasible or document the blocker.
- Every feature below must have real browser interaction verification, not just build success.

## CLAUDE-001 — Navigation restructure: System Overview as its own tab

**Objective:**
Create a dedicated `System` / `Overview` tab/page and move the rich `System overview` control panel out of the hero into that page.

**Required behavior:**

- Add a real system overview view to the app state/router, accessible from the header tabs.
- The top-left BrandMark button behavior must become contextual:
  - If user is **not** on hero: clicking BrandMark returns to hero/home.
  - If user **is already on hero**: clicking BrandMark opens the new System Overview tab/page.
- When inside System Overview, the standard header must remain visible with all tabs: `chat`, `hermes`, `jobs`, `tools`, and the new `system/overview` tab.
- Remove the `esc` button from the header. Keyboard Escape can still return home if already implemented, but no visible `esc` pill in the header.
- Header tab buttons are still too small on desktop: enlarge them and center the tab group instead of making it start from the left.

**Files likely involved:**

- `src/state/ViewMode.jsx`
- `src/App.jsx`
- `src/components/BrandMark.jsx`
- `src/components/PageNav.jsx`
- `src/components/PageNav.css`
- `src/components/PageShell.jsx`
- `src/components/PageShell.css`
- new `src/components/system/SystemOverviewPage.jsx`
- new `src/components/system/SystemOverviewPage.css`

**Verification gate:**

- Build passes: `npm run build`.
- Browser QA:
  - Hero loads.
  - BrandMark on hero opens System Overview.
  - BrandMark from System Overview returns to hero.
  - Header shows all tabs on System Overview.
  - No visible `esc` button remains.
  - Header tabs are centered and larger on desktop.
  - No header overlap at common desktop widths.
- Console has zero application errors.

**Commit rule:**
Commit when verified:

```text
feat: add system overview tab navigation
```

## CLAUDE-002 — Rich real System Overview page

**Objective:**
Make System Overview a richer operational dashboard, not the current sparse panel.

**Required information, using real backend/bridge data where available:**

- Gateway health, latency, auth status and configured base URL label.
- Machine stats: CPU, memory, disk, uptime.
- Platforms: Telegram, Discord, WhatsApp, etc. with connected/error state.
- Usage: OpenAI weekly + Claude weekly/5h with restored circular usage rings.
- Sessions: recent sessions and current active/running session.
- Jobs summary: enabled, paused, failed, next run.
- Tools/toolsets summary: enabled/disabled count.
- MCP servers summary: connected/missing/error count.
- Model/profile summary: current default provider/model and active profile.
- Memory summary: memory providers, counts, readiness.

**Implementation notes:**

- Use the existing `src/lib/hermesBridge.js` client functions where possible.
- If missing endpoints exist in the backend plugin/Vite bridge, add real bridge routes rather than mocking data.
- Any unavailable data must render a diagnostic card with the precise missing endpoint/config.
- Do not keep the current large `System overview` card in the hero once this page exists.

**Verification gate:**

- Build passes.
- Browser QA System Overview page:
  - all sections render without overlap
  - real successful data renders when available
  - degraded/missing data renders diagnostic cards
  - no empty black dead zones
- Console has zero application errors.
- Inspect Network/console enough to confirm requests hit real `/local/hermes/*` or gateway/dashboard endpoints, not hardcoded mocks.

**Commit rule:**
Commit when verified:

```text
feat: enrich system overview dashboard
```

If blocked by missing bridge/backend capabilities, commit:

```text
docs: record system overview backend blockers
```

with exact endpoints needed.

## CLAUDE-003 — Restore usage circles and keep compact hero usage overview

**Objective:**
Restore circular usage indicators and keep a small usage overview visible in the hero.

**Required behavior:**

- Restore usage circles/rings for OpenAI and Claude usage.
- Use circles in the new System Overview page.
- Add a compact, non-intrusive hero usage overview so Marco can keep usage under watch from the hero.
- The hero usage overview must be small and aligned with the hero composition; it must not reintroduce scattered telemetry.
- Usage values must come from the real existing usage sources/bridge, not mock values.

**Files likely involved:**

- `src/state/Usage.jsx`
- `src/components/UsageOrbs.jsx` or replacement ring component
- `src/components/Hero.jsx`
- `src/components/Hero.css`
- `src/components/system/SystemOverviewPage.jsx`

**Verification gate:**

- Build passes.
- Hero visually checked: compact usage visible, no clutter, no overlap with title/input/portrait.
- System Overview visually checked: circles are readable and larger/richer.
- Values update from the real usage context/bridge.
- Console has zero errors.

**Commit rule:**
Commit when verified:

```text
feat: restore usage rings and hero usage summary
```

## CLAUDE-004 — Real backend controls: memory, models, jobs, tools, MCP

**Objective:**
Turn the command center into a working control surface. These controls must actually call Hermes/backend endpoints.

**Required features:**

1. **Hermes memory editing**
   - Make it possible to view, edit, add and remove Hermes memory entries from the UI.
   - Must persist through the real backend/profile memory store.
   - Do not fake local-only state.

2. **Default model switching**
   - Make it possible to change the default provider/model from UI.
   - Use existing `setHermesModel` if correct, or fix/extend bridge/backend route.
   - UI must confirm success/failure from backend.

3. **Create new jobs**
   - Jobs page must support creating new cron jobs, not only editing existing ones.
   - Required fields: name, schedule, prompt, delivery target/default, enabled toolsets if supported.
   - Must call real backend scheduler/cron endpoint.

4. **Tool and MCP activation/linking**
   - Make it possible to enable/disable toolsets where Hermes supports it.
   - Make it possible to connect/configure MCP servers if real backend supports it.
   - If backend does not expose safe write endpoints yet, create a documented blocker with exact route/schema required.

5. **File attach fix**
   - Fix chat file attachment so it accepts practical common file types, not only overly narrow specific files.
   - Validate frontend accept list and backend upload constraints.
   - Common desired types: images, PDFs, text/markdown, CSV/JSON, code files, docs where supported.
   - Must verify real upload/attach behavior, not just input `accept` attribute.

**Verification gate:**

- Build passes.
- Real browser interaction tests:
  - edit/add/remove one safe memory test entry, then read it back; clean up if needed.
  - change model or run through the real endpoint with a safe reversible selection; confirm backend response.
  - create a safe disabled/test cron job; verify it appears; remove/disable it if removal exists or mark it clearly as test.
  - enable/disable one safe toolset only if reversible and supported.
  - upload/attach at least one allowed small test file and confirm UI/backend accepts it.
- Console has zero errors.
- No secrets are logged or committed.

**Commit rule:**
Break into multiple commits if needed:

```text
feat: add real memory management controls
feat: add default model selection controls
feat: add cron job creation flow
feat: add tool and mcp connection controls
fix: broaden and verify chat file attachments
```

If any subfeature is blocked, commit a blocker note under `docs/claude/status/` and continue with the independent subfeatures.

## CLAUDE-005 — Page polish, dashboard density, and final report

**Objective:**
Make the whole app feel like a coherent command center and leave a factual report.

**Required UI polish:**

- Header tabs larger and centered on desktop.
- No `esc` button in header.
- Page shells should feel like dashboard surfaces, not sparse empty pages.
- Jobs/Tools/Hermes pages must have useful diagnostic cards and summaries even when backend data is missing.
- Keep the hero cinematic but operational: identity + command input + small usage overview only.
- Avoid adding decorative noise. Every visible telemetry block must answer a real operational question.

**Final verification gate:**

- `git status --short --branch` clean.
- `npm run build` passes.
- Browser QA all views: Hero, Chat, System Overview, Hermes, Jobs, Tools.
- Console has zero application errors.
- Verify at desktop width and at least one mobile/narrow width.
- Write a concise report under `docs/claude/status/` with:
  - branch + latest SHA
  - completed chunks
  - commands run
  - exact backend endpoints used
  - what works for real
  - any blockers needing Marco/Hermes input

**Commit rule:**
Commit final report:

```text
docs: add system overview implementation report
```

## Non-negotiable acceptance criteria

- No fake controls.
- No local-only simulation for backend features.
- No new SOUL.md content stuffing.
- Header centered and larger on desktop.
- System Overview exists as a real tab/page.
- BrandMark contextual behavior works.
- Hero keeps compact usage overview and no longer carries the large system panel.
- Usage rings are restored.
- Memory editing, model default switching, job creation, file attach, tools/MCP controls are either working against real backend endpoints or documented with exact backend blockers.
