# Claude Instructions 006 — UI Consolidation, Interactive Glass Polish, Canvas V2, and Performance Split

## Context

Marco reviewed the new Project Workspace pass and agrees with the direction, but the UI still feels too rudimentary in several places. The issue is no longer missing architecture; it is product feel, hierarchy, motion, scale, and consolidation.

Important scope note:

- Marco is already separately asking for `+ Project` and `+ Notes` button placement improvements. Do **not** spend this instruction file duplicating that exact task.
- This file should handle everything else: richer glass components, larger readable controls, less selectable raw text, interactive hover/motion states, optional left rail collapse/hide behavior, Canvas V2, code splitting, responsive cleanup, and coherence fixes.

## Product North Star

The UI should stop feeling like a developer dashboard with decorated text and start feeling like a premium command center:

```text
large readable controls
interactive glass buttons
clear hierarchy
fluid hover/motion
less raw selectable text
workspace-first layouts
strong but restrained teal identity
real backend/vault persistence
```

Bad target:

```text
tiny labels + selectable text blocks + flat buttons + cramped rail + static panels
```

Good target:

```text
glass command surfaces + generous hit areas + hover depth + motion + readable hierarchy + smooth workspaces
```

## Operating Rules

- Work chunks in numeric order unless a chunk is blocked and a later chunk is independent.
- Verify every chunk before moving to the next.
- Commit locally after each verified chunk.
- Push to GitHub only once after the whole instruction file is completed or all blockers are documented.
- Do not commit `.env.local`, credentials, tokens, private vault content, generated personal notes/projects, or smoke artifacts.
- Do not fake backend/vault/Kanban/Hermes behavior. If something cannot be verified, show diagnostic/blocker.
- Visual changes require browser QA. A passing build is not visual proof.
- Preserve functionality from instructions 004/005: Obsidian-backed notes/projects, project workspace, custom canvas, workflows, project chat, per-project Kanban, smoke tests.

---

## CLAUDE-001 — Create shared interactive glass component primitives

**Objective:**

Replace scattered rudimentary text/button styling with reusable, readable, interactive glass primitives.

**Files likely involved:**

- `src/styles/global.css`
- `src/components/PageShell.css`
- new `src/components/ui/GlassButton.jsx`
- new `src/components/ui/GlassPanel.jsx`
- new `src/components/ui/GlassCard.jsx`
- new `src/components/ui/GlassToolbar.jsx`
- optional `src/components/ui/*.css`
- existing page/component CSS where primitives are adopted

**Implementation notes:**

- Build reusable classes/components for:
  - primary action button;
  - secondary glass button;
  - danger/archival action;
  - glass card/panel;
  - segmented controls;
  - toolbar button;
  - status chip.
- Default controls should be bigger and easier to hit:
  - minimum height around `40–44px` for important buttons;
  - stronger padding;
  - readable type scale.
- Add clear interaction states:
  - hover lift/shine;
  - active press;
  - keyboard focus ring;
  - disabled state;
  - subtle teal glow for primary actions.
- Reduce raw selectable-text feeling:
  - labels/counts should sit inside cards/chips/buttons where interactive;
  - non-editable text that behaves like UI chrome should not look like loose document text.
- Do **not** blindly add `user-select: none` everywhere. Inputs/editors/notes/canvas text must remain selectable/editable where appropriate.

**Verification gate:**

- `npm run build` passes.
- Browser QA confirms controls are larger/readable and not cramped.
- Keyboard focus is visible on key controls.
- No input/editor text selection is broken.
- Browser console has zero JS errors.

**Commit rule:**

Commit when verified with message:

```text
style: add interactive glass UI primitives
```

---

## CLAUDE-002 — Apply glass primitives to System Overview, Notes, Projects, and Project Workspace

**Objective:**

Make the main dense sections look and feel coherent, interactive, and less rudimentary.

**Files likely involved:**

- `src/components/system/SystemOverviewPage.jsx`
- `src/components/system/SystemOverviewPage.css`
- `src/components/notes/NotesPage.jsx`
- `src/components/notes/NotesPage.css`
- `src/components/projects/ProjectsPage.jsx`
- `src/components/projects/ProjectsPage.css`
- `src/components/projects/ProjectWorkspace.jsx`
- project panels under `src/components/projects/`
- shared UI primitives from CLAUDE-001

**Implementation notes:**

- System Overview:
  - turn raw stat text into larger glass cards/chips;
  - improve hover states on summary cards;
  - keep the Obsidian vault card prominent and readable;
  - make activity/commit rows feel like cards/command rows, not plain text lines.
- Notes:
  - make note list items larger and more tactile;
  - improve filter/tag controls;
  - make empty states rich and useful;
  - preserve free notes behavior.
- Projects:
  - make project cards larger and more beautiful;
  - improve workspace internal sidebar and content cards;
  - make tab/sidebar entries feel draggable/clickable where appropriate, not just text labels.
- Do **not** duplicate the separate `+ Project` / `+ Notes` CTA task Marco is already giving elsewhere, but do ensure any existing action controls share the improved glass primitives.

**Verification gate:**

- Browser QA on System Overview, Notes, Projects list, Project Workspace Overview.
- Visual hierarchy is clearly improved:
  - larger controls;
  - less loose raw text;
  - stronger hover/active states;
  - no overlap.
- `npm run build` passes.
- Browser console zero errors.

**Commit rule:**

Commit when verified with message:

```text
style: polish glass surfaces across core workspaces
```

---

## CLAUDE-003 — Rework global left rail/navigation ergonomics

**Objective:**

Fix the left rail feeling cramped/bruttino now that the app has many sections. Either make it beautiful and useful, or let Marco hide/collapse it.

**Files likely involved:**

- `src/components/PageNav.jsx`
- `src/components/PageNav.css`
- `src/components/PageShell.jsx`
- `src/components/PageShell.css`
- `src/App.jsx`
- chat shell/header CSS if separate

**Implementation notes:**

- Add desktop rail states:
  - expanded rail;
  - compact/collapsed rail;
  - optionally auto-collapse or toggle via a button.
- Use icons/short labels if helpful, but keep labels understandable.
- Make nav entries larger and more tactile.
- The rail must not visually compete with project workspace internal sidebar.
- If inside a Project Workspace, consider a quieter global rail and stronger project sidebar.
- Fix mobile overflow from the shared top/page nav.
- Preserve quick access to all sections.
- Avoid tiny click targets and microscopic labels.

**Verification gate:**

- Browser QA desktop:
  - expanded rail readable;
  - collapsed rail usable;
  - no content overlap;
  - Project Workspace + internal sidebar still clear.
- Browser QA mobile/narrow width:
  - no horizontal overflow from global navigation;
  - controls wrap/collapse cleanly.
- `npm run build` passes.
- Console zero errors.

**Commit rule:**

Commit when verified with message:

```text
fix: improve global rail navigation ergonomics
```

---

## CLAUDE-004 — Fix Projects/Notes data-state coherence and copy mismatches

**Objective:**

Remove confusing UI states and inconsistent claims after the large workspace implementation.

**Files likely involved:**

- `src/components/projects/ProjectsPage.jsx`
- `src/components/projects/ProjectChatPanel.jsx`
- `src/components/projects/ProjectKanbanPanel.jsx`
- `src/components/notes/NotesPage.jsx`
- `src/state/Projects.jsx`
- `src/state/Notes.jsx`

**Known issues to address:**

- Projects list can show something like `Search 4 projects…` while filters/counts say `0`, making the data state feel contradictory.
- Project chat context currently may say Kanban is not linked yet even though project Kanban / project relation features now exist.
- Empty/filtered states should distinguish:
  - no active records;
  - archived records exist;
  - filter hides records;
  - vault connected but empty.
- Make copy honest, concise, and precise.

**Implementation notes:**

- Align counts with visible filters.
- Add archived/test/history distinction where useful.
- Project chat context should include real project Kanban status when available:
  - linked task count;
  - open/blocked task summary;
  - relation mechanism if needed.
- Do not overpromise LLM/project analysis unless real endpoint exists.

**Verification gate:**

- Projects empty state with no active projects is clear.
- Projects search/filter count is not contradictory.
- Project chat seed accurately reflects notes/canvas/workflows/Kanban state.
- `npm run build` passes.
- Browser console zero errors.

**Commit rule:**

Commit when verified with message:

```text
fix: clarify project and note data states
```

---

## CLAUDE-005 — Canvas V2: connectors, resize, snap, node toolbar, undo/redo

**Objective:**

Upgrade the custom canvas from a functional MVP into a richer, more tactile thinking surface.

**Files likely involved:**

- `src/components/projects/canvas/ProjectCanvas.jsx`
- `src/components/projects/canvas/ProjectCanvas.css`
- `src/state/Projects.jsx`
- `src/lib/obsidianBridge.js`
- `vite-plugins/obsidianBridge.js`

**Implementation notes:**

Add, if feasible in this pass:

- connector/edge creation between nodes;
- visible connector lines/arrows;
- node resize handles;
- snap-to-grid toggle;
- duplicate node;
- delete node with confirmation/undo where sensible;
- undo/redo for recent canvas actions;
- node toolbar on select/hover;
- selected state and focus outline;
- better empty canvas onboarding.

Persistence:

- Continue using custom JSON in the vault.
- Persist `edges` as real active data only if the UI supports creating/rendering them.
- Debounce writes and avoid excessive file churn.

UX:

- dragging should feel smooth;
- controls must be larger and obvious;
- the entire node/card header can be used for drag where appropriate;
- do not put interactive inputs inside the drag handle area if it steals pointer events.

**Verification gate:**

- Create canvas.
- Add at least two nodes.
- Connect nodes with an edge.
- Resize a node.
- Drag nodes and confirm positions persist after reload.
- Undo/redo at least one action if implemented.
- Reload page and confirm nodes/edges/sizes persist from vault JSON.
- `npm run build` passes.
- Browser console zero errors.

**Commit rule:**

Commit when verified with message:

```text
feat: upgrade project canvas interactions
```

---

## CLAUDE-006 — Performance split for heavy sections

**Objective:**

Stop the growing app bundle from turning into a beautiful but overweight block of glass.

**Files likely involved:**

- `src/App.jsx`
- route/view loading logic
- `vite.config.js` if needed
- maybe split feature files under Projects/Canvas/Workflows/Notes/Kanban

**Implementation notes:**

Current warning observed by Hermes review:

```text
Some chunks are larger than 500 kB after minification
```

Likely candidates for lazy loading:

- Projects / Project Workspace;
- Project Canvas;
- Project Workflows;
- Notes;
- Kanban;
- Command Palette if heavy.

Use `React.lazy` / `Suspense` or Vite-compatible dynamic imports where appropriate.

Requirements:

- Loading states should look like intentional glass skeletons, not raw text.
- Do not break state providers or existing routing/view mode.
- Measure build output before/after and report chunk sizes.

**Verification gate:**

- `npm run build` passes.
- Bundle warning is reduced or explained if still present.
- Navigating to lazy sections works:
  - Notes;
  - Projects;
  - Project Workspace;
  - Canvas;
  - Workflows;
  - Kanban.
- Browser console zero errors.

**Commit rule:**

Commit when verified with message:

```text
perf: lazy load heavy workspace sections
```

---

## CLAUDE-007 — Responsive and mobile cleanup

**Objective:**

Fix app-wide mobile/narrow layout overflow and cramped action rows.

**Files likely involved:**

- `src/components/PageShell.css`
- `src/components/PageNav.css`
- `src/components/notes/NotesPage.css`
- `src/components/projects/ProjectsPage.css`
- `src/components/projects/canvas/ProjectCanvas.css`
- `src/components/projects/workflows/ProjectWorkflows.css`
- `src/components/kanban/KanbanPage.css`

**Implementation notes:**

Known issue from Claude's report and Hermes review:

- mobile/nav overflow around 375px width;
- action rows in Notes/Project panels may not wrap;
- project workspace two-pane layout collapses at 900px, but smaller widths still have action/button row issues.

Fix:

- global navigation responsive behavior;
- action rows wrap/stack cleanly;
- canvas toolbar remains usable on narrow widths;
- project sidebar does not crush content;
- no horizontal document scroll.

**Verification gate:**

- Browser QA at desktop width.
- Browser QA at tablet-ish width.
- Browser QA around 375px width.
- No horizontal overflow on System, Notes, Projects, Project Workspace, Canvas, Kanban.
- `npm run build` passes.

**Commit rule:**

Commit when verified with message:

```text
fix: clean up responsive workspace layouts
```

---

## CLAUDE-008 — Real Project Intelligence handoff upgrade

**Objective:**

Improve Project Intelligence without faking unavailable LLM analysis.

**Files likely involved:**

- `src/components/projects/ProjectIntelligencePanel.jsx`
- `src/components/projects/ProjectChatPanel.jsx`
- `src/state/Chat.jsx`
- `src/lib/hermesBridge.js`
- `src/lib/obsidianBridge.js`

**Implementation notes:**

- Keep deterministic summary as baseline.
- Improve the handoff to Hermes:
  - include project overview;
  - linked notes count/list;
  - canvas list;
  - workflow active/blocked steps;
  - project Kanban tasks if available;
  - relevant tags.
- If a real analysis endpoint exists, use it. If it does not, add an explicit `Analyze in Chat` flow that seeds a rich context prompt and lets Hermes answer through normal chat.
- Do not display a generated AI summary unless one was actually generated by a backend/model call.

**Verification gate:**

- Intelligence panel loads for empty project.
- Intelligence panel loads for populated project.
- `Analyze in Chat` or equivalent handoff opens chat with accurate context.
- No fake model summary appears.
- `npm run build` passes.

**Commit rule:**

Commit when verified with message:

```text
feat: improve project intelligence handoff
```

---

## CLAUDE-009 — Final QA, smoke, report, one final push

**Objective:**

Consolidate this polish pass and push once.

**Required checks:**

- `npm run build` passes.
- `npm run smoke` passes. If the terminal env lacks Obsidian vars but the `hermes` container has them, document the exact run context; do not misreport an env-only skip as a product failure.
- Browser QA:
  - System Overview;
  - Notes;
  - Projects list;
  - Project Workspace Overview;
  - Canvas V2 interactions;
  - Workflows;
  - Project Chat handoff;
  - Project Kanban;
  - mobile/narrow layout.
- Browser console zero JS errors.
- Security scan on diff: no credentials, no private vault content, no `.env.local`.
- Cleanup any QA/smoke artifacts from vault and Kanban.

**Final report:**

Create a short report:

```text
docs/claude/status/YYYY-MM-DD_workspace_polish_performance_report.md
```

Include:

- implemented chunks;
- build/smoke results;
- bundle size before/after if changed;
- visual QA summary;
- remaining limitations;
- blockers if any.

**Push rule:**

Push to GitHub only once after the whole file is complete or blockers are documented.
