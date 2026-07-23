# Project Operating System — Final Report

Executed from `docs/claude/2026-07-23_1323_CLAUDE_INSTRUCTIONS_009.md`
(CLAUDE-001 through CLAUDE-009). All nine chunks completed and verified
against the real running app and real vault; no blockers required
deferring any chunk.

## Chunks completed

1. **Audit** — live audit of the workspace, found one confirmed bug
   (Intelligence panel's state tiles unstyled — CSS lived in a different
   page's stylesheet the Projects page never loads) plus concrete,
   measured scale gaps (`.btn-pill` at 27.8px/~11px text vs a 42px/0.82rem
   target).
2. **Scale pass** — grew controls/rows/chips throughout the workspace,
   scoped to `.project-workspace` so shared primitives (`.btn-pill`,
   `.notes-meta-select`, `.status-badge`, `.canvas-list-item`...) don't
   change size on Notes/Kanban/System Overview/Jobs, which use the same
   classes. Fixed the Intelligence tile bug in the same pass.
3. **Project Home dashboard** — the Overview tab (relabeled "Home") now
   leads with real state: identity facts, created/updated timestamps, a
   state tile grid (notes/canvases/workflows/Kanban tasks/assets/blocked,
   each tile a real link into its section), latest-changed notes, open
   blockers, and a deterministic suggested next action. Intelligence
   trimmed down to just the Hermes-chat bridge now that its tiles live on
   Home.
4. **Cross-linking** — a note's "+ canvas" creates a real note-ref node on
   the project's canvas; canvas note-ref/kanban-ref nodes and workflow
   step links (`linkedNoteId`/`linkedCanvasId`/`linkedTaskId` — fields
   that already existed but had no "open" affordance) now have real "open"
   actions, with a stale-link indicator when a note/canvas no longer
   resolves.
5. **Contextual Hermes actions** — Chat grew from one button to seven
   (ask about the project, summarize notes, generate next steps, turn
   canvas into tasks, turn workflow into Kanban, draft a Claude
   instruction file, find blockers), each seeding the same real
   project-context message (now including canvas node titles and
   workflow step titles) plus a visible instruction line — never a
   result presented as already generated.
6. **Activity timeline** — a new Activity tab backed by a real,
   vault-persisted log (`Hermes/Projects/<Project>/activity.json`, two
   new bridge routes), since canvases/workflows/assets carry no
   modification timestamp anywhere else in this build. Logged from real
   mutation points: project creation, note link/unlink, canvas/workflow
   creation, asset upload, Hermes actions launched.
7. **Richer templates** — every template now seeds a real starter note
   and real linked Kanban tasks, not just a workflow/canvas. Added the
   missing "Learning / Research" template and renamed the rest to match
   the instruction file's own naming.
8. **Visual coherence pass** — live walk-through of every tab; most
   coherence already held by construction (every new tab reused the same
   primitives). One real gap found and fixed: Canvas/Workflows section
   headers were missing the item count every other list-style tab shows.
9. **Final QA, report, push** — this document.

## Cross-linking verified

- Note → "+ canvas" → real note-ref node created, jumped to canvas.
- Canvas note-ref node → "open note →" → correct note selected in Notes.
- Canvas kanban-ref node / workflow step → "open Kanban board →" → real
  main board.
- Workflow step → "open →" for linked note and linked canvas → both
  navigate to the exact target, including across the Workflows→Canvas tab
  boundary.
- Project Home tiles → each links into its real section.
- Reload persistence confirmed for workflow step links (survived a full
  page reload) and for Activity entries.

## Hermes contextual actions

All seven actions verified to seed real project data (confirmed via the
"Turn canvas into tasks" message containing actual canvas node titles:
"Entry point, Core logic, Storage / bridge..." and actual workflow step
titles). Actions with nothing to act on (no canvases, no blockers) are
disabled with a reason. No Hermes analysis endpoint exists on this
backend — every action stays a seed-and-review flow, never a
pre-generated result.

## Activity/template integration

Confirmed live that template seeding (project → note → 4 Kanban tasks)
produces a correctly-ordered Activity timeline entry for each step
automatically, with no special-casing needed — the same
`logProjectActivity` call sites used elsewhere fired for free.

## Build / smoke / browser QA results

- `npm run build`: passes clean after every chunk, including the final
  state.
- `npm run smoke`: **45/45 checks passed** on the final run.
- Browser QA: every project tab (Home, Notes, Canvas, Workflows, Kanban,
  Activity, Chat, Intelligence) walked through live at desktop, tablet
  (768px), and mobile (375px) widths — no horizontal overflow at any
  width, tiles/action rows wrap cleanly, console zero errors throughout
  every verification pass in this session.
- A disposable realistic project was built covering every object type in
  one place: template-seeded note/workflow/4 Kanban tasks, 2 canvases, a
  real uploaded asset, a Hermes action launch, and the resulting Activity
  log — verified together, not just individually.

## Real vault checks

- Uploaded test asset, created notes/canvases/workflows/Kanban tasks all
  confirmed real via direct API checks and live UI (not mocked).
- Canvas JSON references stay vault-relative (`assets/<filename>`); no
  absolute paths or embedded data.
- Cleanup: both disposable test projects
  (`_HERMES_UI_SMOKE_TEST_DELETE_ME project-os-audit` and
  `...template-research`) archived via the app's own archive UI, which
  moves the whole project folder (including assets/canvases/workflows)
  out of the active `projects/` directory in one operation — nothing
  hard-deleted, consistent with this codebase's "archive, never delete"
  design. All 5 disposable Kanban tasks created during this session
  (`t_6b46c530`, `t_96d4c60c`, `t_73550280`, `t_9ac6aec6`, `t_7ac1ef5c`)
  archived via the real Kanban archive endpoint.
- The pre-existing `HERMES_UI_QA_DELETE_ME` project (not created by this
  execution) was left untouched, per the standing note from an earlier
  session.

## Security scan

- No secrets, API keys, or credentials in any commit's diff (checked via
  pattern grep against the full `origin/main..HEAD` diff).
- No `.env.local` tracked — only the pre-existing `.env.local.example`
  template.
- No uploaded test binaries committed — the test PNG only ever existed in
  the real vault (now inside the archived test project), never in this
  git repo.
- No private vault content (notes, project descriptions, chat transcripts)
  committed — every commit this run touched only source code, CSS, and
  status-report docs. The Activity log's own append route explicitly caps
  and truncates entries (200 chars, no full file contents) so it can't
  become a private-data leak either.

## Remaining limitations / blockers

- **Canvas/workflow/asset "Latest changes"** still can't show a real
  modification time — the underlying files carry no timestamp in this
  build (documented, not silently faked; the Home dashboard says so
  explicitly). The new Activity log is the honest workaround for "did
  something happen and when," but it only captures events from the
  specific mutation points wired up this session (creation/linking/
  upload/Hermes-action), not every possible edit (e.g. editing a
  workflow step's title isn't logged — would be too noisy per-keystroke).
- **Kanban task ↔ note/canvas/workflow-step linking stays one-directional**
  from the workflow step's own `linkedTaskId` field — Kanban tasks
  themselves have no custom-field storage in the real CLI-backed system to
  hold a reverse link back to a specific note/canvas node.
- **"Open Kanban board"** navigates to the real main board but doesn't
  deep-link to/highlight the specific task — no per-task detail view
  exists elsewhere in this app to link to.
- Everything else from the audit was addressed within this pass.

## Commits (this execution, oldest to newest)

```text
f589358 docs: record project operating system audit
2d9afe5 style: increase project workspace UI scale
f1a60fc feat: add project home dashboard
dc3e745 feat: add project cross-linking actions
c1e4a7d feat: add contextual Hermes project actions
1e9bb9c feat: add project activity timeline
e5cae70 feat: add richer project templates
ce3f0a9 style: unify project workspace visual system
```

Pushed to GitHub as a single push after this report's commit, per the
instruction file's push rule.
