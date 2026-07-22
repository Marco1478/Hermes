# Workspace polish + performance pass — final report

Executed from `docs/claude/2026-07-22_1711_CLAUDE_INSTRUCTIONS_006.md`
("UI Consolidation, Interactive Glass Polish, Canvas V2, and Performance
Split"), all 9 chunks, chunk-by-chunk with live browser verification and a
commit after each verified chunk. Single push at the end, per the
instruction file's push rule.

## Implemented chunks

| # | Summary | Commit |
|---|---|---|
| CLAUDE-001 | Shared glass UI primitives (`GlassButton`/`GlassCard`/`GlassToolbar`/`GlassSegmented`) | `style: add interactive glass UI primitives` |
| CLAUDE-002 | Applied glass primitives + sizing/spacing polish across System Overview, Activity Center, Notes, Projects | `style: polish glass surfaces across core workspaces` |
| CLAUDE-003 | Collapsible left rail navigation (`RailCollapse` context, localStorage-persisted) | `fix: improve global rail navigation ergonomics` |
| CLAUDE-004 | Projects/Notes empty-state and search-placeholder coherence | `fix: clarify project and note data states` |
| CLAUDE-005 | Canvas V2 — real persisted edges, connector-drag-to-connect, resize handles, grid snap, undo/redo | `feat: upgrade project canvas interactions` |
| CLAUDE-006 | Code-split every workspace page except Hero/Chat behind `React.lazy` + `Suspense` | `perf: lazy load heavy workspace sections` |
| CLAUDE-007 | App-wide responsive/mobile cleanup, closed a real 641–860px header-collision gap | `fix: clean up responsive workspace layouts` |
| CLAUDE-008 | Shared project-context builder (`projectContext.js` + `useProjectSignals.js`), "Analyze in Chat" handoff | `feat: improve project intelligence handoff` |
| CLAUDE-009 (this pass) | Final QA pass; found and fixed a real duplicate-key race condition in Notes/Projects state | `fix: dedupe notes/projects state against a create-vs-reload race` |

Two additional fixes landed before chunk 001, in response to direct user
bug reports (mobile "+" button invisible at ≤640px; create-project/note
actions redesigned as full card tiles matching the Kanban visual language)
— not part of the instruction file but part of this session's continuous
work, each committed separately (`fix: keep header action button visible
at narrow widths`, `style: replace create-note/project pills with
card-shaped add tiles`).

## Build / smoke results

- `npm run build`: **passes**, 0 errors, 0 warnings (chunk-size warning
  from the pre-split baseline is gone now that CLAUDE-006 code-splits the
  bundle).
- `npm run smoke`: **44/44 checks passed**. Ran directly in this terminal
  against the real `hermes` container (env vars for gateway, dashboard,
  Kanban SSH bridge, and Obsidian vault were all present — no env-only
  skip needed, full end-to-end run including obsidian/Kanban round-trip
  checks).

## Bundle size before/after

Compared against `origin/main` (`eca316b`, pre-polish-pass baseline) via a
throwaway `git worktree` build, since CLAUDE-006 (code splitting) is the
only chunk that materially changes bundle shape:

| | Baseline (monolithic) | After CLAUDE-006 (code-split) |
|---|---|---|
| Eagerly-loaded JS | 555.37 kB (161.08 kB gzip) | 402.69 kB (**125.86 kB gzip**) |
| Eagerly-loaded CSS | 79.59 kB (14.27 kB gzip) | 31.86 kB (**7.10 kB gzip**) |
| Remainder | — (all in the one bundle) | ~16 lazy JS chunks + ~12 lazy CSS chunks, fetched per-view on first visit |

Initial-load JS gzip payload dropped **~22%** (161.08 kB → 125.86 kB);
initial CSS gzip dropped **~50%** (14.27 kB → 7.10 kB). Hero and Chat stay
eager (first-seen views); every other workspace (Jobs, Tools, System,
Kanban, Notes, Projects, Safety, Missions, Hermes/Memory Studio) loads its
JS+CSS chunk only when the user actually opens that tab.

## Visual QA summary

Browser-verified (real backend data, real vault, real Kanban board) across
every required surface, each checked for zero console errors:

- **System Overview** — usage rings, machine/jobs/tools tiles, Obsidian
  Vault tile (notes/projects/last-edit counts), Recent Sessions, Agent
  Activity Center. No overflow at any width.
- **Notes** — active/archived toggle, folder/tag filters, create/import/
  link-existing, checklist, color/tag editing.
- **Projects list** — active/archived toggle, status/priority filters,
  search, new-project card tile with template picker.
- **Project Workspace Overview** — name/status/priority/due/color/tags/
  description/milestones editing, archive toggle.
- **Canvas V2** — node creation (Text/Sticky/Card/Decision/Circle/
  Checklist/refs), drag (verified `getComputedStyle(node).transform` is
  `none` after drag — the framer-motion residual-transform bug from
  CLAUDE-005 stays fixed), connector-drag-to-connect, resize handles,
  snap-to-grid, undo/redo, all with zero console errors.
- **Workflows** — create workflow, add step, assignee/status/note-ref/
  Kanban-ref pickers, blocked-step state.
- **Project Chat handoff** — "Start Hermes chat for this project" and
  "Analyze in Chat →" both verified to seed an accurate, real-data context
  message (actual note titles, workflow names/status, blocked-step
  details, Kanban counts) — confirmed via `textarea.value` inspection
  against a populated test project, not just visually.
- **Project Kanban** — create/link task from a project, task appears on
  the main Kanban board with the project tag, archive round-trips
  correctly.
- **Mobile/narrow layout** — 375px (compact nav strip, stacked header,
  wrapping canvas toolbar) and 768px (the CLAUDE-007 tablet-gap fix) both
  checked: zero horizontal overflow (`scrollWidth === clientWidth` at
  both widths), zero console errors.

### Bug found and fixed during this QA pass

Reproduced a real "Encountered two children with the same key" React
console error: creating a project note and then immediately opening a
different tab that reads the notes list (e.g. a workflow step's note
picker) could show — and, in the state, actually contain — the same note
twice. Root cause: `NotesProvider`/`ProjectsProvider`'s vault-load mount
effect is double-invoked by React 19 `StrictMode` in dev, so two
concurrent full-list fetches are in flight; if one resolves after a
same-tick `createNote()`/`createProject()` write has already landed on
disk, its snapshot already contains the new item, and the create call's
own optimistic prepend then re-adds it under the same id.

Fixed by deduping by id at every point notes/projects state is built
(vault-load merge, create-time prepend, `duplicateNote`'s insert) —
correct regardless of how many times the effect fires, unlike an
effect-level guard (which was tried first, reverted after it broke
`vaultStatus` ever reaching `"connected"`: StrictMode's interposed cleanup
fires between the two invocations and stops the first one's async chain,
which is the one a naive re-entry guard leaves as the only survivor).
Verified fixed across three independent fresh-tab reproductions of the
exact original race, backend data confirmed consistent throughout (the
bug was a client-state artifact, not vault file corruption).

## Remaining limitations

- The System Overview scroll-regression check in `npm run smoke` is a
  static CSS assertion, not a real rendered scroll test — a Playwright (or
  similar) browser check would close that gap, as already noted in an
  earlier status report.
- Archiving a note frees its filename for reuse (e.g. a second blank note
  can become `Untitled.md` again after the first is archived); an
  archived project's `linked_notes` frontmatter isn't automatically
  cleaned up when its linked note gets archived, so an old archived
  project can end up "linked" to a same-named note it never actually
  referenced. Confirmed via direct backend inspection this is inert (no
  crash, no console error, no data loss) and pre-dates this session's
  changes — flagged here as a minor product quirk, not fixed, since it's
  outside this pass's scope.
- `HERMES_UI_QA_DELETE_ME` (an active project with description "Temporary
  browser QA project") was left untouched — it wasn't created during this
  session and its ownership was never confirmed, so it was neither
  archived nor used beyond read-only viewing during QA, per this
  session's established caution around not touching state that might not
  be mine to clean up.

## Blockers

None. All chunks implemented, verified, and committed; the one bug found
during final QA was fixed and re-verified before this report was written.

## Push

Single push to `origin/main` follows this report, per the instruction
file's push rule.
