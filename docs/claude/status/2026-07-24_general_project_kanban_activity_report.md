# General Kanban, Project Kanban Mirroring, Cozy Home, Claude Code Activity — Final Report

Executed from `docs/claude/2026-07-23_1826_CLAUDE_INSTRUCTIONS_010.md`
(CLAUDE-001 through CLAUDE-009). All chunks implemented and verified
against the real backend (Kanban bridge, Obsidian vault) and a clean
build; no fake mirroring, no fake Claude Code launcher.

## Model

One task, one identity, everywhere:

- A real Kanban task has no `projectId` field in the CLI-backed backend.
  The project<->task relation is the pre-existing `linkedKanbanIds` array
  on the project's Obsidian frontmatter (`state/Projects.jsx`'s
  `linkTask`/`unlinkTask`) — this build reuses it rather than inventing a
  second relation or a duplicated task copy.
- **Main Kanban** (`KanbanPage.jsx`) builds a `projectByTaskId` reverse
  lookup from `projects[].linkedKanbanIds` over the one already-loaded
  task list. A task with no entry renders a neutral `○ General` chip; a
  task with an entry renders `◆ <project name>` in the project's color
  (`lib/projectColor.js`, a new single source of truth for swatch-key →
  CSS color, shared by Kanban chips, `ProjectKanbanPanel`'s header dot,
  and Project Home's accent).
- **Project Kanban** (`ProjectKanbanPanel.jsx`) is unchanged in kind — it
  was already a filtered view over the same real tasks, not a separate
  board — and now also carries the project's color dot/tags in its header
  and gained the same real status actions the main board's drag-drop
  offers (promote/complete/block/unblock), each calling the same
  `kanbanBridge.js` functions the main board uses, so a status change in
  either view is the same task record everywhere.
- **Main Kanban filters**: `All / General-Inbox / Blocked / Hermes /
  Claude`, plus a project select and a project-tag select (tag comes from
  the linked project, since a task has no tag field of its own), plus a
  "recently updated" sort. Only real, checkable buckets — no invented
  owner/tag semantics beyond what the backend actually stores.
- **One-shot project → Main Kanban handoff**: `ProjectKanbanPanel`'s "open
  in main board →" now calls `useViewMode().goToKanban(projectId)` instead
  of a bare `goTo("kanban")`. `ViewMode.jsx` carries a one-shot
  `kanbanFilterProjectId`, consumed immediately by `KanbanPage` on arrival
  (sets the project filter, then clears the pending value) — a temporary
  filtered handoff, not a second site-wide project board, per Marco's
  clarification that Main Kanban/System Overview stay the only site-wide
  surfaces.
- Assignment is bidirectional from the task side too: a new
  `KanbanProjectAssign` drawer section (Main Kanban's task detail) lets a
  General task be assigned to a project, or a project task be returned to
  General/Inbox — both through the same `linkTask`/`unlinkTask` relation,
  so unassigning doesn't move or delete anything, it just drops the link.

## Project Home (cozier + prominent)

- "Home" moved out of the tab row entirely into a dedicated
  `project-workspace-home` button above `SECTIONS` in the sidebar
  (`ProjectWorkspace.jsx`), colored with the project's accent — it's the
  natural landing spot, not a same-weight tab labeled "Home".
- `ProjectOverviewPanel.jsx`'s header is now a `project-home-hero` panel
  with a soft project-color glow (`--home-accent`, from
  `projectColorVar`), keeping identity/status/priority/due/color/tags,
  adding a "Today / Next" block (the same deterministic suggested-action
  logic, promoted from a small buried panel into the hero), a compact
  "latest activity" mini-list (last 3 real entries from the same
  `fetchProjectActivity` the Activity tab reads, reusing its
  `TYPE_GLYPH` export), and a primary-actions row (Ask Hermes / Open
  Kanban / + Note / + Canvas / Claude Code activity ↗).
- The state-tile grid, blockers, and recent-notes sections below the hero
  are unchanged in substance from Instructions 009 — this pass only
  restyled the header into a warmer hero and relocated the "next action"
  copy into it.

## Activity: noise filtering + Claude Code lifecycle

- No new noise was introduced: this pass's only new activity writes are
  `kanban` events on real state transitions a human explicitly triggers
  from `ProjectKanbanPanel` (`Task completed: "..."` /
  `Task blocked: "..."`) — not on every drag, promote, or unblock, which
  stay silent as intermediate, non-milestone moves. Existing project/note/
  canvas/asset/workflow/Hermes event logging from Instructions 009 is
  untouched.
- `claude_code` is now a real, renderable activity type (`TYPE_GLYPH`
  `▶` in `ProjectActivityPanel.jsx`) — added so that if/when a server-side
  Claude Code runner starts appending events through the same
  `logProjectActivity` API, they render with no further UI change. **No
  fake launcher was added**: this build still has no per-project Claude
  Code runner, so nothing calls this event type yet. Project Home's
  "Claude Code activity ↗" button is honest about this — it opens the
  real, already-existing site-wide Agent Activity Center (System
  Overview: git commits + `docs/claude` status reports), not a project-
  scoped view that doesn't exist, with an explicit tooltip saying so.

## Verification

- `npm run build` — passes, no errors.
- `npm run smoke` — 45/45 checks passed against the real gateway,
  dashboard, Kanban bridge, and Obsidian vault (reversible test task
  create/archive, project<->kanban relation frontmatter round-trip, path
  traversal rejected, no leftover test data).
- Static review of every changed file confirms: single task identity
  (no second Kanban store or duplicate task copy anywhere in the diff),
  one-shot (not persistent) project filter handoff, no fabricated Claude
  Code execution.
- This finalization pass did not re-run an interactive browser session
  (headless finalization only, per the scoped instructions for this
  pass) — build and smoke are real backend checks, not proof of visual
  layout. Browser QA of the cozy Home/Kanban chip styling remains a
  recommended follow-up before further visual polish work.

## Security scan

- No secrets/API keys/credentials/private-key markers found in the diff
  (`git diff` against `origin/main` grepped for common secret patterns —
  no hits).
- `.env.local` and `smoke-report.local.json` are untracked/ignored, not
  staged.
- No uploaded binaries, generated user files, or vault content in this
  diff — source, CSS, and this doc only.

## Remaining limitations

- Project Kanban's status actions (promote/complete/block/unblock) cover
  the same real transitions the main board's drag-and-drop supports;
  `running`/`review` stay worker-set states with no direct human command,
  same as the main board.
- Claude Code lifecycle events are render-ready but not yet emitted by
  any runner — documented above, not silently faked.

## Commits (this execution)

```text
feat: define Kanban task project ownership model
feat: add focused per-project Kanban boards
feat: aggregate project tasks in main Kanban
style: make project home cozier and more prominent
fix: keep project activity focused on important events
feat: show Claude Code lifecycle in project activity
style: polish Kanban and project activity integration
docs: add general Kanban/project/activity final report
```

Pushed to GitHub as a single push after this report's commit, per the
instruction file's push rule.
