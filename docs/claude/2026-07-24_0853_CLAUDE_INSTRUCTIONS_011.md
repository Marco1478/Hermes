# Claude Instructions 011 — Replace Missions with Automation Dashboard, Claude Runs, Server-Side Runner Control, and Review Flow

## Context

Marco approved the next strategic step after Instructions 010.

The current app has become a real project operating system: Obsidian-backed Projects/Notes, full-width workspaces, usable custom Canvas, real asset uploads, Workflows, Main Kanban + Project Kanbans, Project Home, Activity, contextual Hermes actions, and server-side Claude Code already authenticated through Marco's Claude Pro subscription in the Hermes container.

The next product move is **not** another passive tab. Replace the old `Missions` tab, which mostly showed a log/list of generated instruction documents, with a true operational dashboard for server-side automation.

Marco's direction:

- Replace/supersede the existing `Missions` tab.
- The new surface should be the dashboard for Claude Code / Automation.
- It should make Claude Code work visible, controllable, resumable, and reviewable from the UI.
- It must connect to the controlled-autonomy loop:

```text
Project context
→ Claude instructions
→ Claude Code server-side run
→ build/smoke/review
→ commit/push/report
→ Activity/Kanban/Project Home/System Overview updated
```

## Product North Star

Bad target:

```text
Missions = passive list of instruction docs
silent Claude Code process
no run status
no way to continue/review
no changed-file visibility
no relation to Project Activity/System Overview
fake Start button that does nothing
freeform terminal exposed in UI
```

Good target:

```text
Automation tab replaces Missions
Claude Runs are visible and persisted
runs are linked to projects/instruction files/repos
status/log/checks/diff summary are reviewable
continue/review/follow-up actions are safe and constrained
Project Activity and System Overview show meaningful automation state
no fake launcher, no arbitrary shell execution, no hidden automation
```

## Operating Rules

- Work chunks in numeric order unless blocked and later chunks are independent.
- Verify each chunk before moving to the next.
- Commit locally after each verified chunk.
- Push to GitHub only once at the end after the final report/status artifact is created.
- If a backend/bridge/safe-runner capability is missing, create an honest diagnostic/blocker and continue independent UI/data-model chunks.
- Do not fake Claude Code execution. A visible diagnostic is better than a fake success state.
- Do not expose a raw terminal or arbitrary shell input in the UI.
- Do not commit `.env.local`, credentials, tokens, private vault content, uploaded binaries, generated user files, disposable QA artifacts, `dist`, `node_modules`, or `smoke-report.local.json`.
- Never print `GITHUB_TOKEN`, Claude credentials, dashboard credentials, API keys, or OAuth tokens.
- Preserve prior working functionality from Instructions 004–010.
- Visual UX changes require browser QA; build success alone is not proof.

---

## CLAUDE-001 — Audit current Missions tab and server-side Claude Code state

**Objective:**

Understand the current `Missions` surface, navigation wiring, instruction-document log behavior, and any existing Claude Code/Automation support before replacing the concept.

**Files likely involved:**

- `src/components/missions/MissionPipeline.jsx`
- `src/components/missions/MissionPipeline.css`
- `src/App.jsx`
- `src/components/PageShell.jsx`
- `src/components/PageShell.css`
- `src/state/ViewMode.jsx`
- `src/components/system/SystemOverviewPage.jsx`
- `src/components/projects/ProjectActivityPanel.jsx`
- `src/components/projects/ProjectOverviewPanel.jsx`
- `src/components/projects/ProjectWorkspace.jsx`
- `src/lib/*`
- `vite-plugins/*`
- `scripts/*`
- `docs/claude/status/*`

**Audit checklist:**

- Locate how `Missions` is shown in navigation.
- Identify whether it is only a document/report log or has real actions.
- Identify instruction-file discovery logic, if any.
- Identify whether any existing scripts/wrappers already launch Claude Code.
- Identify whether `/opt/data/claude-runs/` or similar run logs are visible to the app/backend.
- Identify any existing bridge pattern for safe local/server actions.
- Identify where Project Activity currently renders Claude Code lifecycle events from Instructions 010.
- Identify what is safe to implement now without adding an arbitrary command executor.

**Verification gate:**

- Final report includes concise audit summary.
- No code changes required unless renaming/wiring preparation is harmless and verified.

**Commit rule:**

If creating an audit artifact, commit with:

```text
docs: record Automation dashboard audit
```

---

## CLAUDE-002 — Replace Missions concept with Automation tab/surface

**Objective:**

Turn the existing Missions slot into the new `Automation` surface, while preserving access to useful instruction-document history inside the new dashboard as a secondary panel.

**Files likely involved:**

- `src/components/missions/MissionPipeline.jsx`
- `src/components/missions/MissionPipeline.css`
- Optionally create/rename:
  - `src/components/automation/AutomationDashboard.jsx`
  - `src/components/automation/AutomationDashboard.css`
  - `src/components/automation/ClaudeRunsPanel.jsx`
  - `src/components/automation/InstructionHistoryPanel.jsx`
- `src/App.jsx`
- `src/state/ViewMode.jsx`
- navigation/sidebar files

**Implementation notes:**

- The navigation label should become `Automation` or `Claude Runs` depending on existing visual width. Prefer `Automation` for future scope.
- The main page heading should make the purpose explicit:

```text
Automation Command Center
Claude Runs, instructions, checks, and review flow.
```

- Existing instruction-document list/history can remain, but it must no longer be the main product value.
- First-class panels should be:
  - Active/Recent Claude Runs;
  - Run Detail / Review status;
  - Instruction history/drafts;
  - Automation health/diagnostics.
- If no run registry exists yet, show an honest empty/diagnostic state and proceed to implement the registry in later chunks.

**Verification gate:**

- The old `Missions` label/content is replaced or clearly superseded.
- Navigation still works.
- Instruction history remains accessible if previously useful.
- Empty states explain what is missing without pretending runs exist.
- Build passes.
- Browser QA confirms the new tab reads as a dashboard, not a document log.

**Commit rule:**

Commit when verified with:

```text
feat: replace Missions with Automation dashboard shell
```

---

## CLAUDE-003 — Add persistent Claude Runs registry/model

**Objective:**

Introduce a safe persistent model for server-side Claude Code runs that the UI can read and display.

**Files likely involved:**

- `src/lib/automationBridge.js` or similar
- `vite-plugins/automationBridge.js` or existing bridge plugin
- `src/components/automation/*`
- `scripts/*` if needed
- project Activity helpers if shared

**Required run shape:**

```json
{
  "id": "run_...",
  "projectId": null,
  "projectName": null,
  "instructionFile": "docs/claude/....md",
  "repoPath": "/opt/data/repos/Hermes",
  "branch": "main",
  "status": "running | completed | failed | max-turns | blocked | pushed | unknown",
  "startedAt": "ISO timestamp",
  "endedAt": "ISO timestamp or null",
  "logPath": "/opt/data/claude-runs/....log",
  "changedFiles": [],
  "commits": [],
  "buildResult": null,
  "smokeResult": null,
  "reportPath": null,
  "blocker": null
}
```

**Storage notes:**

Prefer a simple server-side JSON registry that is easy for Hermes/Claude wrapper scripts to update, for example:

```text
/opt/data/claude-runs/runs.json
/opt/data/claude-runs/runs/<run-id>.json
```

or a repo-local ignored file if already configured:

```text
.claude-runs.local.json
```

Do not commit live run data unless it is an intentional sanitized fixture. Live run registry should be ignored/untracked.

**Bridge/API notes:**

Expose read-only endpoints first:

```text
GET /local/automation/runs
GET /local/automation/runs/:id
GET /local/automation/runs/:id/log?tail=200
```

If route naming differs in existing bridge style, follow the project convention.

**Verification gate:**

- UI can load empty registry without crash.
- UI can load a sanitized test run record.
- Log tail reads a bounded amount of text, not full unbounded logs.
- Path traversal is rejected.
- Build passes.
- Smoke updated if appropriate.

**Commit rule:**

Commit when verified with:

```text
feat: add Claude Runs registry
```

---

## CLAUDE-004 — Add safe server-side Claude runner wrapper support

**Objective:**

Create or wire a constrained runner mechanism for Claude Code that can start/continue approved instruction-file runs without exposing arbitrary shell execution.

**Important constraint:**

If a safe runner cannot be implemented end-to-end in this pass, do not fake it. Implement diagnostics/read-only registry and document the blocker.

**Files likely involved:**

- `scripts/claude-runner.mjs` or `.sh`
- `vite-plugins/automationBridge.js`
- `src/lib/automationBridge.js`
- `src/components/automation/*`
- `.gitignore`
- docs/status report

**Allowed runner inputs:**

```text
instructionFile: must be under docs/claude/ and match *_CLAUDE_INSTRUCTIONS_*.md
projectId: optional existing project id
mode: start | continue
maxTurns: constrained allowed range, e.g. 20-100
```

**Forbidden inputs:**

```text
raw shell command
raw repo path from UI
raw environment variables
arbitrary log path
arbitrary output path
```

**Runner behavior:**

- Uses fixed repo path `/opt/data/repos/Hermes` unless project supports explicit safe repo metadata later.
- Exports Obsidian env vars required for smoke.
- Launches Claude Code via tmux or background process.
- Writes/updates run registry with status changes.
- Writes bounded logs to `/opt/data/claude-runs/`.
- Does not print secrets.
- If push is involved, uses existing `GITHUB_TOKEN` env without logging it.
- Records max-turns / blocked / completed / pushed states.

**Bridge endpoints, only if safe:**

```text
POST /local/automation/runs/start
POST /local/automation/runs/:id/continue
POST /local/automation/runs/:id/checks
```

If POST endpoints are not safe yet, provide read-only dashboard and diagnostic copy:

```text
Server-side runner not connected yet. Hermes can launch Claude from Telegram/terminal; UI read/control bridge is pending.
```

**Verification gate:**

- A harmless dry-run/read-only run can be registered or diagnostic blocker is documented.
- No arbitrary shell path can be passed through UI/API.
- Registry status updates are visible in UI.
- Path traversal rejected.
- Build passes.
- Smoke passes or blocker documented.

**Commit rule:**

Commit when verified with:

```text
feat: add safe Claude runner bridge
```

If only diagnostics/read-only are possible:

```text
docs: document Claude runner bridge blocker
```

---

## CLAUDE-005 — Build Claude Runs dashboard inside Automation tab

**Objective:**

Make the Automation tab useful even before full write-control is complete by displaying runs, status, diagnostics, and review state clearly.

**Files likely involved:**

- `src/components/automation/AutomationDashboard.jsx`
- `src/components/automation/AutomationDashboard.css`
- `src/components/automation/ClaudeRunsPanel.jsx`
- `src/components/automation/ClaudeRunDetail.jsx`
- `src/components/automation/RunStatusBadge.jsx`
- `src/lib/automationBridge.js`

**Dashboard content:**

- Active run card.
- Recent runs list.
- Status badges:
  - running;
  - completed;
  - failed;
  - max-turns;
  - blocked;
  - pushed;
  - unknown.
- Instruction file link/name.
- Project chip if project-linked.
- Repo/branch.
- Start/end time.
- Last log tail.
- Changed files count/list if available.
- Commits if available.
- Build/smoke status if available.
- Report path if available.
- Diagnostic state if registry/runner unavailable.

**Aesthetic direction:**

- This is the automation command center, not a file list.
- Use disciplined dark glass UI, teal/cyan accents, strong readable hierarchy.
- Avoid dense raw logs as the first thing the user sees.
- Show log tail in a secondary expandable panel.

**Verification gate:**

- Empty state looks intentional.
- Test/sanitized run records render correctly.
- Log tail is bounded and readable.
- Status badges are visually distinct.
- Mobile/narrow layout does not overflow.
- Build passes.
- Browser QA confirms it feels like a command surface.

**Commit rule:**

Commit when verified with:

```text
feat: build Claude Runs automation dashboard
```

---

## CLAUDE-006 — Add Project-level Claude Runs panel

**Objective:**

Each project should show related Claude Runs in its workspace so project automation is visible near the actual work context.

**Files likely involved:**

- `src/components/projects/ProjectWorkspace.jsx`
- `src/components/projects/ProjectOverviewPanel.jsx`
- `src/components/projects/ProjectActivityPanel.jsx`
- `src/components/projects/ProjectsPage.css`
- `src/components/automation/*`
- `src/lib/automationBridge.js`

**Implementation notes:**

- Add `Automation` or `Claude Runs` section/panel in project workspace only if it does not overload navigation.
- Prefer integrating into Project Home first:

```text
Active Automation
Last Claude Run
Last build/smoke
Next recommended action
```

- If adding a project workspace section, it should filter runs by `projectId`.
- If a run has no project, it remains site-wide in the Automation tab.

**Verification gate:**

- Project Home shows latest/active project-linked run if present.
- Site-wide/general runs do not incorrectly appear as project runs.
- Project Activity can link to a run detail where available.
- Build passes.
- Browser QA project workspace.

**Commit rule:**

Commit when verified with:

```text
feat: surface Claude Runs in project workspace
```

---

## CLAUDE-007 — Add review surface for diff, checks, and follow-up decisions

**Objective:**

After Claude Code finishes or blocks, the UI should help Hermes/Marco decide what happens next.

**Files likely involved:**

- `src/components/automation/ClaudeRunDetail.jsx`
- `src/components/automation/RunReviewPanel.jsx`
- `src/lib/automationBridge.js`
- `vite-plugins/automationBridge.js`
- optional scripts for safe summary generation

**Review data:**

- Changed files.
- Commit list.
- Current git status if safely available.
- Build result.
- Smoke result.
- Browser QA note if available.
- Sensitive-value/security scan result if available.
- Blockers.
- Recommended next action.

**Safe actions:**

- `Continue run` if max-turns/blocked and safe runner exists.
- `Run build/smoke` if safe check endpoint exists.
- `Create follow-up instruction draft` if implemented safely.
- `Open report` / `copy summary`.

**Forbidden for this pass unless explicitly safe:**

- raw push button without review gate;
- raw shell command;
- arbitrary file delete/reset;
- force push;
- editing sensitive env/config from UI.

**Verification gate:**

- Review panel renders completed, blocked, and max-turns states.
- Safe actions are disabled/diagnostic if bridge unavailable.
- No action claims success without backend confirmation.
- Build passes.
- Browser QA interaction states.

**Commit rule:**

Commit when verified with:

```text
feat: add Claude run review surface
```

---

## CLAUDE-008 — Integrate Automation into Activity, System Overview, and Project Home

**Objective:**

Claude Runs should not live in isolation. The rest of the app should reflect automation state.

**Files likely involved:**

- `src/components/system/SystemOverviewPage.jsx`
- `src/components/projects/ProjectOverviewPanel.jsx`
- `src/components/projects/ProjectActivityPanel.jsx`
- `src/components/projects/ProjectsPage.css`
- `src/lib/automationBridge.js`
- `src/lib/projectContext.js`

**System Overview integration:**

Add compact widget/cards for:

- active Claude runs;
- blocked/max-turns runs;
- last pushed run;
- latest build/smoke status;
- link to Automation tab.

**Project Home integration:**

Show:

- Active Automation;
- Last Claude Run;
- Last check result;
- Next action:
  - continue run;
  - review diff;
  - create follow-up instruction;
  - no active automation.

**Activity integration:**

Activity should show meaningful events only:

```text
Claude Code started
Claude Code reached max turns
Claude Code completed
Claude Code pushed
Hermes review completed
Follow-up instruction drafted
```

Do not spam activity with log lines, autosaves, every file read, or every build asset.

**Verification gate:**

- System Overview displays automation state or diagnostic empty state.
- Project Home displays project-linked automation state.
- Activity shows meaningful events only.
- No fake completed/pushed events.
- Build passes.
- Browser QA System + Project Home + Activity.

**Commit rule:**

Commit when verified with:

```text
feat: integrate automation state across Hermes UI
```

---

## CLAUDE-009 — Preserve instruction history inside Automation without making it primary

**Objective:**

The old Missions document log can remain useful, but it should become a secondary part of the Automation dashboard.

**Files likely involved:**

- old Missions component or new Automation components
- `src/lib/*` instruction discovery helpers
- CSS

**Implementation notes:**

- Show recent instruction docs and status reports in a compact panel.
- Link instruction docs to runs where possible.
- If there is no run yet for an instruction, show `not launched` or `manual only` honestly.
- Do not let instruction history dominate the page.

**Verification gate:**

- Recent instructions are still discoverable.
- They do not crowd out Claude Runs.
- No misleading launched/completed state for docs without run records.
- Build passes.

**Commit rule:**

Commit when verified with:

```text
feat: keep instruction history in Automation dashboard
```

---

## CLAUDE-010 — Visual polish, QA, report, one final push

**Objective:**

Ship the Automation dashboard as a coherent product surface.

**Required verification:**

- `npm run build` passes.
- `npm run smoke` passes with Obsidian env:

```bash
OBSIDIAN_VAULT_PATH=/opt/data/obsidian-vault \
OBSIDIAN_NOTES_DIR=Hermes/Notes \
OBSIDIAN_PROJECTS_DIR=Hermes/Projects \
OBSIDIAN_ARCHIVE_DIR=Hermes/Archive \
npm run smoke
```

- Browser QA:
  - Automation tab loads;
  - old Missions list is no longer the primary experience;
  - active/empty/completed/blocked run states render;
  - Project Home automation panel renders;
  - System Overview automation widget renders;
  - Activity automation events render;
  - mobile/narrow layout has no horizontal overflow;
  - console zero JS errors.
- Security scan:
  - no secrets;
  - no `.env.local`;
  - no live Claude credentials;
  - no uploaded/private vault files;
  - no generated logs committed unless intentionally sanitized fixtures.
- Git status clean after commit/push.

**Final report:**

Create:

```text
docs/claude/status/YYYY-MM-DD_automation_claude_runs_report.md
```

Include briefly:

- Missions replacement summary;
- registry/runner support status;
- UI dashboard summary;
- project/system/activity integrations;
- safe actions implemented vs diagnostic blockers;
- build/smoke/browser QA;
- limitations and next recommended step.

**Push rule:**

Push to GitHub only once after all verified chunks are complete or blockers are documented.
