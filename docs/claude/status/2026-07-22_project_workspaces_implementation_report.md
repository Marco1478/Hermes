# Project Workspaces implementation — status report

Ran against instruction file `docs/claude/2026-07-22_1324_CLAUDE_INSTRUCTIONS_005.md`.

## Shipped

All 12 chunks (CLAUDE-001 through CLAUDE-012), each committed separately:

- **001–003** — glass UI pass, dedicated project workspace shell
  (`ProjectWorkspace.jsx`, internal Overview/Notes/Canvas/Workflows/
  Kanban/Chat/Intelligence sidebar replacing the old slide-over drawer),
  free-note linking into projects.
- **004** — custom project canvas: pan/zoom board, 10 typed node presets,
  drag-to-move with debounced persistence.
- **005** — project workflow builder: ordered, drag-reorderable steps
  (owner/status/linked note/canvas/Kanban task/command per step).
- **006** — Hermes chat seeded with real project context (notes/canvas/
  workflow counts, Obsidian folder path) — pre-filled in the composer,
  nothing sent until the user hits Send.
- **007** — cross-object tag explorer (project + linked notes + canvases +
  workflows), with tag normalization (`src/lib/tags.js`) applied at every
  creation site.
- **008** — project-scoped Kanban (`ProjectKanbanPanel.jsx`): shows only a
  project's linked tasks; creating/linking one also makes it visible on
  the *main* board with a project color chip. Relation lives on the
  project side (`linkedKanbanIds` in frontmatter) — never an invented
  field on the real Kanban task, which has no such setter.
- **009** — deterministic Project Intelligence panel (active notes/
  workflows/open+blocked task counts, last-updated note, rule-based
  suggested next action). Not an LLM feature — no Hermes analysis/
  summarize endpoint exists on this build, so the "Ask Hermes" section is
  an honest diagnostic with a working handoff button into the real Chat
  tab instead of a fake summary.
- **010** — six project creation templates (`src/lib/projectTemplates.js`):
  Generic, Hermes feature, Web client project, AI video/Higgsfield
  project, Business outreach, Portfolio/demo project. Pre-fill the New
  Project form; Hermes feature and the others also scaffold a starter
  workflow (Hermes feature additionally gets a starter "Architecture map"
  canvas) via the same real write calls the Workflows/Canvas tabs use.
- **011** — `npm run smoke` extended with `checkProjectWorkspaces()`:
  project/canvas/workflow create-update-archive, note↔project linking,
  and the project↔Kanban relation, all against the real vault/CLI through
  the same bridge modules the dev server imports. Also updated
  `docs/OBSIDIAN_VAULT_SETUP.md` for the new folder layout and file
  formats.
- **012** — this report; final QA pass; one push.

## Verified

- `npm run build` passes throughout every chunk.
- `npm run smoke`: **44/44** on the final run (was 43/44 mid-CLAUDE-011
  until a real bug was caught and fixed — see below).
- Tested against the **real mounted vault and real Kanban CLI** end to
  end, not a temporary stand-in: every write path (project/canvas/
  workflow/note create-edit-link-archive, Kanban task create/block/
  archive from inside a project) confirmed both in the UI and via direct
  SSH inspection, with every test artifact cleaned up afterward (vault
  confirmed empty of `_HERMES_UI_SMOKE_*`/`HERMES_UI_SMOKE_*` artifacts at
  the end of the session — a `find -iname '*SMOKE*'` only turned up
  earlier archived manual-QA projects, already tracked as expected
  leftovers, not this run's).
- Full CLAUDE-012 visual QA pass (fresh browser tab, zero prior console
  history) covering every required surface: System Overview glass cards,
  free/global Notes, Notes linked to a project, Projects list, the "+"
  New Project flow (including the template picker), the project
  workspace sidebar, Project Overview, Project Notes (new/import/link),
  Canvas (create → add card node → drag → reload → position persisted),
  Workflows (create two steps → drag-reorder → reload → order persisted),
  project Kanban → main board visibility (with project color chip),
  Hermes chat context seed, tag filters (pill click → filtered count →
  clear filter), Project Intelligence, and responsive behavior at mobile/
  tablet widths.
- Browser console: **zero JS errors** across the entire pass (confirmed
  in a fresh tab with no carried-over history — an earlier apparent error
  from a mid-session file deletion turned out to be a stale console
  buffer tied to the old tab, not a real, reproducible error; verified by
  opening a new tab and restarting the dev server).
- Diff scanned for secrets: no API keys/passwords/tokens in the diff
  against `origin/main`; `.env.local` correctly untracked (only the
  placeholder `.env.local.example` is); no private vault/note/project
  content committed.

## Bug caught and fixed during this pass

`kanban archive <id>` has no `--json` output — just a plain confirmation
line — so the new smoke check's `runJson()` call on it always failed with
a JSON-parse error. Fixed by switching to `runText()`, matching how the
app's own `/local/kanban/archive` route already calls it
(`vite-plugins/hermesBridge.js`). This only affected the smoke script,
never the real UI (the UI's own archive action was already correct).

## Design decisions worth flagging

- **No fake backend fields anywhere in this feature set**: project↔Kanban
  relation lives in the project's own `linked_kanban` frontmatter, never
  a `project_id` on the task; canvas `edges` is always `[]` since this
  build has no UI to create one (populating it would be inert data);
  Project Intelligence's "last updated" only covers notes, since
  canvases/workflows are plain JSON files the bridge never `stat()`s —
  inventing a timestamp for them would be the same violation.
- **Templates are starting points, not remembered types** — picking one
  pre-fills normal, already-editable project fields (description/color/
  tags) and optionally scaffolds a workflow/canvas through the same real
  write calls the Workflows/Canvas tabs use; nothing is tagged "from
  template X" in the saved data, and a scaffold failure (e.g. vault not
  connected) never blocks project creation itself.
- **Reused the proven drag pattern** from Kanban's own column reorder for
  both canvas node dragging and workflow step reordering — in each case,
  the fix that finally worked was removing any interactive input from the
  drag-handle area (a pointerdown on a nested input steals the gesture
  before it reaches the handle), matching the one thing that always
  worked correctly in the pre-existing Kanban board.

## Known limitations (not blockers)

- **Stale project references after filename reuse**: a note's stable
  filename is assigned once at creation and freed up again once the note
  is archived (moved out of the active `Notes/` dir). If a brand-new note
  reuses a title whose old file was archived while still linked to a
  project (i.e. archived without first unlinking), the new note silently
  inherits that old, still-archived project's link — because the
  relation is keyed on filename, not a separate stable ID. Reproduced
  live during this QA pass. Low real-world likelihood (requires reusing
  an exact old title after archiving without unlinking first), but worth
  fixing later — either clear `linkedNoteIds`/`linked_notes` entries on
  archive, or key the relation on something that doesn't get freed for
  reuse.
- **Mobile nav-bar overflow is pre-existing and app-wide**, not
  introduced by this feature: at 375px width, the shared top `PageNav`
  tab strip overlaps/overflows on *every* page, including pages this
  instruction file never touched (confirmed by comparing the untouched
  Kanban page at the same width). The Project Workspace's own two-pane
  layout does correctly collapse to a single stacked column at ≤900px
  (existing breakpoint in `ProjectsPage.css`); the remaining gap is
  narrower than that — individual action-button rows (e.g. Notes'
  "+ new project note / + import text / + link existing note") don't
  wrap at true phone width and contribute to the same horizontal
  overflow. Not fixed here since it's a pre-existing, page-nav-wide issue
  outside this instruction file's scope, not a regression.
- Canvas/workflow files carry no real "last updated" timestamp (see
  above) — Project Intelligence is explicit about this rather than
  faking one.
- `docs/claude/status/*.md` reports (including this one) are hand-written
  markdown, not generated from a structured test-run artifact — fine for
  now given the project's scale, but would need a different approach if
  this grows into a CI-driven workflow.

## Blockers

None for this instruction file's scope. The vault and real Kanban CLI
were reachable and correctly configured throughout; every chunk was
verified against the real backend, not a stand-in.

One **unrelated, pre-existing** condition worth noting for awareness (not
caused by, or fixed in, this instruction file): the Hermes dashboard
service on the box has needed a manual restart twice during this overall
session (container restarts don't bring it back automatically, since it
isn't under s6 auto-start supervision) — both times diagnosed and fixed
via the documented `hermes dashboard --host 0.0.0.0` restart procedure.
At the time of this report the dashboard is up and all dashboard-
dependent smoke checks pass; flagging the underlying "not auto-started"
condition as a possible future infra fix, outside this UI repo's scope.

## Final commit/push

Pushed once, after this report, per the instruction file's push rule.
