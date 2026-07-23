# Project Operating System — Audit (CLAUDE-001 of Instructions 009)

Audited in the running app against a disposable project
(`_HERMES_UI_SMOKE_TEST_DELETE_ME project-os-audit`, template "Hermes feature")
with a linked note, the template's starter canvas (3 nodes) and workflow (6
steps), and a linked Kanban task — covering every workspace tab. Findings
below are what shapes CLAUDE-002 through CLAUDE-008.

## Confirmed bug (not just scale): Intelligence tiles are unstyled

`ProjectIntelligencePanel.jsx` renders `.overview-tile-grid` /
`.overview-tile` / `.overview-tile-label` / `.overview-tile-value` /
`.overview-tile-sub`, but those classes are defined **only** in
`src/components/system/SystemOverviewPage.css` — a different code-split
page's stylesheet that `ProjectsPage.jsx` never imports. Live result: the
four state tiles render as unstyled inline text with no grid, no label/value
separation, no spacing — `ACTIVE NOTES1`, `ACTIVE WORKFLOWS11 total` read as
one run-on word each. This is the single worst coherence problem found: the
one panel meant to answer "what's the state of this project" is visually
broken. Fix: give the Project Workspace its own `.overview-tile*` rules in
`ProjectsPage.css` (do not rely on another page's chunk loading first).

## Control scale — measured, not eyeballed

| Element | Live height | Live font-size | Target |
|---|---|---|---|
| `.project-workspace-tab` (sidebar nav) | 35.8px | 13.8px | ≥42px |
| `.btn-pill` (used everywhere: unlink, archive, +create, filters) | 27.8px | 10.9px | ≥42px, ≥0.82rem text |
| `.linked-note-title` / `-preview` | n/a | 11.5px / 10.2px | ≥0.82rem |
| `.project-card-meta` | n/a | 9.9px | ≥0.82rem |

`.btn-pill` is the single most-reused control in the whole workspace
(Notes/Workflows/Kanban/Canvas all lean on it for every action), so its
scale increase in CLAUDE-002 will carry the most weight.

## Which controls are too small

- `.btn-pill` — 27.8px tall, ~11px text. Used for nearly every action button
  across every tab (archive, unlink, +new note, +create task, +link
  existing, filters). The single highest-leverage fix.
- `.project-workspace-tab` (the project's own section sidebar) — 35.8px,
  under the 42px floor, and shrinks further (0.68rem, centered 2-letter
  labels) when the nav is collapsed.
- Linked-note rows, Kanban task rows, workflow list rows (`.canvas-list-item`)
  — small text (10–12px), thin single-line rows with little click padding.
- Milestone/checklist rows (Overview tab) — small checkbox + tight row
  height.

## Which cards/rows need larger hit areas

- `.linked-note-row`, `.canvas-list-item` (used by both Kanban and Workflows
  lists) — the whole row isn't clickable in Kanban (only "unlink" is a
  button); in Workflows the row IS a button, inconsistent pattern between
  the two.
- Milestone rows — checkbox + tiny "×" remove button, no padding buffer.

## Which panels feel disconnected

- **Overview vs. Intelligence** — two separate tabs that should be one
  story. Overview is pure fact-editing (name/status/color/tags/milestones);
  Intelligence has the actual "what's going on" tiles + suggested next
  action + Ask Hermes — but you only see it if you think to click a tab
  labeled "Intelligence," which reads like an optional extra, not the
  project's home screen. This is CLAUDE-003's target.
- **Notes** has no way to jump into Canvas/Workflows/Kanban from a note
  itself — only "unlink." No "create canvas node from this note" or "link
  to workflow step" (CLAUDE-004's target, though the workflow step data
  model already has `linkedNoteId`/`linkedCanvasId`/`linkedTaskId` fields —
  just no "open" affordance anywhere they're set).
- **Canvas node refs to note/kanban/workflow** exist as node *types* (`note`,
  `kanban` ref nodes) but there's no reverse direction — a note doesn't know
  a canvas node points at it, and there's no "open the canvas this note is
  referenced from."
- **Chat** is a single button in a mostly-empty panel — functionally fine,
  visually feels like an unfinished stub next to the denser tabs next to it.
  CLAUDE-005 should turn this into a real set of contextual actions instead
  of one.
- **No Activity tab at all** — there is no way to see "what changed
  recently" anywhere in the workspace (Intelligence's "Last updated" is
  literally one note's timestamp, nothing else). CLAUDE-006's target.

## Can you understand project state in 5 seconds?

**No, not from Overview** (the tab you land on) — it's an editable form,
not a summary. **Almost, from Intelligence** — the tiles/next-action/blocked
count are exactly the right information, but the tab is easy to miss and,
as noted above, currently renders broken. Once CLAUDE-003 merges this
content into Home/Overview and CLAUDE-002/the CSS fix land, this should
genuinely resolve in ~5 seconds.

## Can you move from note → canvas → task → workflow naturally?

**No.** Every link direction requires knowing the *ID* of the target
(Kanban: paste a `t_xxxxxxxx` ID by hand; Workflow step: paste a Kanban ID
into a plain text field) or exists as a dropdown-only selection with no
"open" action once selected. The underlying data model already supports a
surprising amount of this (workflow steps already carry linked note/canvas/
task refs) — the gap is almost entirely UI, not backend. Good news for
CLAUDE-004: this should be more UI wiring than new persistence work.

## Does Project Workspace feel like a project OS or just a tab container?

**Tab container**, currently. Seven tabs that don't reference each other,
one broken dashboard tab, no activity feed, no way to act on a note/task/
workflow from anywhere but its own tab. The building blocks (shared
`useProjectSignals`/`buildProjectContextMessage`, workflow step link fields,
real asset upload/library from Instructions 008) are solid — this pass is
about connecting them, not building new plumbing from scratch.

## Scope check against Instructions 009's own chunks

Everything above maps directly onto CLAUDE-002 (scale + the tile CSS bug),
CLAUDE-003 (merge Overview+Intelligence into a real Home), CLAUDE-004
(surface the link fields that already exist as real "open" actions and add
the missing ones), CLAUDE-005 (Chat panel is currently one button, needs
the fuller action set), CLAUDE-006 (no activity feed exists at all),
CLAUDE-007 (templates already seed workflow/canvas but never notes/Kanban,
and "Learning/Research" is missing from the template list), CLAUDE-008
(the Intelligence CSS bug is evidence real visual-coherence gaps exist
beyond just this one panel). No chunk needs re-scoping based on this audit.

## Cleanup

The disposable audit project, its linked note, and its linked Kanban task
are left in place for now — reused as the base for CLAUDE-002 onward's live
verification, per the same pattern Instructions 008 used. Will be archived/
cleaned up in CLAUDE-009's final pass.
