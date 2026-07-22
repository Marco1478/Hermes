# Claude Instructions 007 — Fullscreen Workspaces and Canvas UX Overhaul

## Context

Marco's direct feedback: the Canvas is still a bad UX. The UI direction is acceptable, but the Canvas feels legnosa, rigid, and unpleasant to use. The current state has features, but the interaction model is not yet a fluid creative workspace.

This instruction pack is intentionally narrow:

```text
focus hard on Canvas UX and fullscreen workspace mode
```

Do not spend this pass adding unrelated features. Do not duplicate the existing `+ Project` / `+ Notes` CTA work. Do not make another broad dashboard pass. The target is to make Notes/Projects feel like real full-screen workspaces and make Project Canvas feel usable, tactile, and alive.

## Product North Star

Bad target:

```text
small centered panel
canvas trapped inside a window
raw controls
technical drag behavior
hard-to-hit handles
confusing connector mode
static empty board
```

Good target:

```text
fullscreen workspace
canvas as the main surface
large readable controls
smooth drag/pan/zoom
obvious interaction modes
clear selected/hover states
fast inline editing
rich empty onboarding
persistent Obsidian-backed canvas JSON
```

The Canvas should feel like a premium thinking board, not a debug UI wearing glass.

## Operating Rules

- Work chunks in numeric order unless a chunk is blocked and a later chunk is independent.
- Verify every chunk before moving to the next.
- Commit locally after each verified chunk.
- Push to GitHub only once after the whole file is complete or blockers are documented.
- Do not commit `.env.local`, credentials, private vault content, QA artifacts, or generated personal notes/projects.
- Do not fake upload, asset handling, backend/vault persistence, or AI analysis.
- Visual UX work requires browser QA. A passing build is not enough.
- Preserve previous functionality:
  - Obsidian-backed Notes/Projects;
  - project workspace;
  - custom canvas JSON persistence;
  - connectors/edges;
  - resize;
  - snap-to-grid;
  - undo/redo;
  - project chat;
  - project Kanban.

---

## CLAUDE-001 — Audit current Canvas UX in browser before editing

**Objective:**

Understand why the current Canvas feels bad before changing it. Do not guess from code only.

**Files likely involved:**

- no code changes required unless adding a short status note is useful
- `src/components/projects/canvas/ProjectCanvas.jsx`
- `src/components/projects/canvas/ProjectCanvas.css`
- `src/components/projects/ProjectWorkspace.jsx`
- `src/components/projects/ProjectsPage.css`
- `src/components/PageShell.css`

**Required browser audit:**

Create or use a disposable project/canvas and test:

- entering Projects;
- entering a Project Workspace;
- opening Canvas tab;
- creating a canvas;
- adding at least three node types;
- dragging nodes;
- panning/zooming;
- connecting nodes;
- resizing nodes;
- using undo/redo;
- editing node text/title;
- interacting with the inspector;
- reloading and confirming persistence.

**Audit questions:**

- Does the workspace feel like full screen or like a centered card trapped inside chrome?
- Is the canvas board large enough to breathe?
- Are toolbar and inspector positions obvious?
- Are handles large enough?
- Are interaction modes clear?
- Does drag feel smooth or nervous?
- Does panning fight selecting/editing?
- Are node labels readable?
- Are empty states useful?
- Does the left/global rail steal too much attention?

**Verification gate:**

- Produce a short implementation note in the final report later listing the top UX frictions found.
- Do not commit this audit alone unless you add a status artifact.

**Commit rule:**

No commit required for pure audit. If you create a status artifact, commit with:

```text
docs: record canvas UX audit notes
```

---

## CLAUDE-002 — Make Notes/Projects/Project Workspace fullscreen workspace modes

**Objective:**

When Marco enters Notes or Projects, the UI should feel like a real workspace at screen scale, not a small centered panel.

**Files likely involved:**

- `src/components/PageShell.jsx`
- `src/components/PageShell.css`
- `src/components/notes/NotesPage.jsx`
- `src/components/notes/NotesPage.css`
- `src/components/projects/ProjectsPage.jsx`
- `src/components/projects/ProjectsPage.css`
- `src/components/projects/ProjectWorkspace.jsx`
- `src/components/projects/ProjectWorkspace.css` if present
- `src/state/RailCollapse.jsx`
- `src/App.jsx`

**Implementation notes:**

- Add or refine a `workspace mode` layout for:
  - Notes;
  - Projects;
  - Project Workspace;
  - Project Canvas.
- The workspace mode should:
  - use full available viewport width/height;
  - reduce central card feeling;
  - minimize outer margins;
  - let content sit edge-to-edge within safe glass boundaries;
  - make the internal project sidebar more important than the global rail;
  - optionally auto-collapse or visually quiet the global rail while inside project workspace/canvas.
- Avoid hiding navigation so aggressively that the user feels trapped. Provide a clear return/back path.
- On Canvas tab, maximize the board area. The canvas should be the hero surface.
- On mobile/narrow screens, use drawer-style sidebars or stacked panels, not crushed columns.

**Design target:**

Desktop Project Workspace:

```text
[quiet global rail] [project sidebar] [full-height workspace surface]
```

Canvas tab:

```text
[project sidebar] [canvas toolbar + infinite board] [inspector/drawer]
```

**Verification gate:**

- Browser QA Notes: feels full-width/full-height, not centered modal/card.
- Browser QA Projects: grid/workspace uses screen space correctly.
- Browser QA Project Workspace: sidebar + content fill viewport.
- Browser QA Canvas: board gets maximum useful space.
- No horizontal overflow at desktop/tablet/mobile.
- `npm run build` passes.
- Browser console zero JS errors.

**Commit rule:**

Commit when verified with:

```text
feat: add fullscreen workspace layout mode
```

---

## CLAUDE-003 — Rebuild Canvas interaction model around clear modes

**Objective:**

Make Canvas interactions predictable and fluid by replacing ambiguous behavior with explicit, visible modes.

**Files likely involved:**

- `src/components/projects/canvas/ProjectCanvas.jsx`
- `src/components/projects/canvas/ProjectCanvas.css`
- possibly new `src/components/projects/canvas/CanvasToolbar.jsx`
- possibly new `src/components/projects/canvas/CanvasInspector.jsx`
- possibly new `src/components/projects/canvas/canvasInteractionState.js`

**Implementation notes:**

Canvas should clearly expose modes such as:

- Select / Move;
- Pan;
- Connect;
- Text;
- Shape;
- Asset/Reference;
- maybe Comment/Sticky.

Requirements:

- A visible toolbar or mode bar must show the current mode.
- The active mode should be unmistakable.
- Cursor behavior should match mode.
- Connector creation should not require hunting a tiny dot unless there is also a clear mode/command.
- Panning should not fight node dragging.
- Text editing should not accidentally drag the node.
- Escape should exit active temporary modes or deselect, without breaking app-level navigation.
- Keyboard shortcuts are welcome but must be discoverable.

Suggested shortcuts:

```text
V = select/move
H or Space = pan
C = connect
T = text
R = rectangle/shape
Delete/Backspace = delete selected node/edge
Cmd/Ctrl+Z = undo
Cmd/Ctrl+Shift+Z = redo
```

Only add shortcuts if they do not conflict with existing app/global shortcuts.

**Verification gate:**

- Create nodes in different modes.
- Pan without moving nodes.
- Move nodes without panning.
- Connect two nodes using obvious UI/mode.
- Edit text without dragging node.
- Escape behavior verified.
- Console zero errors.
- `npm run build` passes.

**Commit rule:**

Commit when verified with:

```text
feat: clarify canvas interaction modes
```

---

## CLAUDE-004 — Redesign Canvas surface, toolbar, inspector, and empty state

**Objective:**

Turn Canvas from a technical board into a premium visual workspace.

**Files likely involved:**

- `src/components/projects/canvas/ProjectCanvas.jsx`
- `src/components/projects/canvas/ProjectCanvas.css`
- `src/components/ui/glass.css`
- shared UI primitives if needed

**Implementation notes:**

Canvas surface:

- larger board area;
- richer grid background with subtle depth;
- zoom level clearly visible;
- optional mini coordinate/zoom HUD;
- refined selected state;
- subtle shadows and glows;
- no tiny raw text controls.

Toolbar:

- larger glass buttons;
- grouped tools;
- labels/tooltips;
- obvious active state;
- quick add presets;
- undo/redo/snap/zoom controls with clear feedback.

Inspector:

- should not feel like a cramped form;
- use sections/cards;
- keep it stable, not jumping around;
- support collapse/drawer behavior if it steals canvas space;
- selected node info should be clear and editable.

Empty state:

- should teach the user what to do;
- include direct actions:
  - add text node;
  - add shape;
  - import/reference asset;
  - open mode help;
- should look like part of the canvas, not a placeholder paragraph.

**Verification gate:**

- Browser QA empty canvas: useful and attractive.
- Browser QA populated canvas: toolbar/inspector/board balance is good.
- Controls are bigger and readable.
- Hover/active/focus states visible.
- `npm run build` passes.
- Console zero errors.

**Commit rule:**

Commit when verified with:

```text
style: redesign canvas workspace surface
```

---

## CLAUDE-005 — Improve node UX: inline editing, selection, drag, resize, visual presets

**Objective:**

Make nodes feel pleasant to create, edit, move, resize, and understand.

**Files likely involved:**

- `src/components/projects/canvas/ProjectCanvas.jsx`
- `src/components/projects/canvas/ProjectCanvas.css`
- optional new node components under `src/components/projects/canvas/`

**Implementation notes:**

Node requirements:

- bigger default sizes and fonts;
- clear visual hierarchy inside node;
- inline title/text editing where sensible;
- double-click to edit if appropriate;
- obvious selected state;
- visible drag region but not a tiny handle-only pattern;
- resize handles large enough and not confused with drag;
- smooth drag with sane threshold;
- duplicate/delete controls not easy to hit accidentally;
- shape presets that look intentionally different, not just labels:
  - text card;
  - sticky note;
  - decision diamond;
  - process card;
  - image/reference card;
  - file/reference card;
  - checklist card.

Decision node:

- must remain readable.
- Do not rotate the text. Shape can be diamond, content should still be readable.

Image/file nodes:

- give honest feedback:
  - preview available;
  - unresolved URL/path;
  - file ref only;
  - no upload endpoint if absent.

**Verification gate:**

- Add each important node preset.
- Edit title/content inline or via inspector.
- Drag and resize without accidental duplicate/drag conflicts.
- Decision node readable.
- Image/file node feedback clear.
- Reload and confirm persistence.
- `npm run build` passes.
- Console zero errors.

**Commit rule:**

Commit when verified with:

```text
fix: make canvas nodes easier to edit and manipulate
```

---

## CLAUDE-006 — Add asset import/reference workflow for Canvas without fake upload

**Objective:**

Make images/files usable in Canvas, but only with honest persistence.

**Files likely involved:**

- `src/components/projects/canvas/ProjectCanvas.jsx`
- `src/components/projects/canvas/ProjectCanvas.css`
- `src/lib/obsidianBridge.js`
- `vite-plugins/obsidianBridge.js`
- `src/state/Projects.jsx`
- possibly project assets helpers

**Implementation notes:**

Preferred behavior:

- Each project already has/should have:

```text
Hermes/Projects/<Project>/assets/
```

- Add asset reference flow:
  - paste image URL;
  - reference existing file path in project assets;
  - if current bridge supports upload/copy, import file into assets;
  - if not supported, show clear diagnostic and allow URL/reference card.
- Support drag-and-drop onto canvas if feasible:
  - image URL/text drop creates image node;
  - file drop imports if bridge supports it;
  - otherwise shows honest unsupported message.
- Never pretend a file was uploaded if it was not written to vault.
- Canvas JSON should store relative asset refs where possible.

**Verification gate:**

- Create image URL node and verify preview/failure state.
- Create file reference node and verify displayed path/name.
- If import is implemented, verify file exists under project `assets/` in vault.
- Reload and confirm asset refs persist.
- Unsupported cases show clear feedback.
- `npm run build` passes.
- Console zero errors.

**Commit rule:**

Commit when verified with:

```text
feat: improve canvas asset references
```

---

## CLAUDE-007 — Add Canvas micro-feedback: toasts, save state, command hints

**Objective:**

Remove the feeling that the canvas is silently doing things. Every important action should give subtle feedback.

**Files likely involved:**

- canvas components
- shared notification/toast component if one exists
- or new `src/components/ui/Toast.jsx` / `ToastProvider.jsx`
- `src/components/ui/glass.css`

**Implementation notes:**

Add feedback for:

- saved/saving/error states;
- node added;
- edge created/deleted;
- snap on/off;
- undo/redo;
- asset unresolved;
- unsupported file drop;
- persistence failure.

Requirements:

- feedback must be subtle, not noisy;
- avoid spamming on every drag tick;
- use debounced save status;
- error states must stay visible long enough to read;
- toasts should be reusable later across app if implemented.

**Verification gate:**

- Trigger each major action and confirm feedback appears.
- Dragging does not spam toasts.
- Save state changes are visible.
- Error/unsupported case is readable.
- `npm run build` passes.
- Console zero errors.

**Commit rule:**

Commit when verified with:

```text
feat: add canvas action feedback
```

---

## CLAUDE-008 — Canvas persistence hardening and cleanup

**Objective:**

Ensure the prettier Canvas remains structurally stable and vault-backed.

**Files likely involved:**

- `src/state/Projects.jsx`
- `src/lib/obsidianBridge.js`
- `vite-plugins/obsidianBridge.js`
- `scripts/smoke-backend.mjs`
- canvas components

**Implementation notes:**

- Validate canvas JSON shape before saving/loading.
- Handle corrupt/missing canvas file gracefully.
- Avoid write storms while dragging/resizing:
  - debounce writes;
  - save after gesture end;
  - show saving state honestly.
- Confirm archived/deleted test projects/canvases are cleaned up.
- Extend smoke test only if stable and useful:
  - create project;
  - create canvas;
  - create nodes/edges/assets refs;
  - update canvas;
  - read canvas back;
  - cleanup.

**Verification gate:**

- `npm run smoke` passes.
- Build passes.
- Manual vault file check confirms canvas JSON persisted correctly.
- Reload confirms nodes/edges/assets survive.
- Corrupt/missing file does not crash UI.
- Cleanup QA artifacts.

**Commit rule:**

Commit when verified with:

```text
fix: harden canvas persistence and smoke coverage
```

---

## CLAUDE-009 — Final browser QA and report, one final push

**Objective:**

Verify this Canvas UX overhaul with real visual and interaction evidence, then push once.

**Required final checks:**

- `npm run build` passes.
- `npm run smoke` passes, or any failure is documented with exact reason.
- Browser QA at desktop width:
  - Notes fullscreen workspace;
  - Projects fullscreen workspace;
  - Project Workspace;
  - Canvas empty state;
  - Canvas populated state;
  - canvas drag/pan/zoom/connect/resize/edit/undo/redo;
  - asset URL/reference behavior.
- Browser QA at tablet and narrow mobile width:
  - no horizontal overflow;
  - canvas toolbar usable;
  - inspector/drawer not crushing board.
- Browser console zero JS errors.
- Security scan:
  - no secrets;
  - no `.env.local`;
  - no personal vault content;
  - no QA artifacts committed.
- Cleanup disposable projects/canvases/assets/tasks.

**Final report:**

Create:

```text
docs/claude/status/YYYY-MM-DD_canvas_ux_overhaul_report.md
```

Keep it brief but useful:

- what changed;
- what UX frictions were fixed;
- build/smoke/browser QA results;
- remaining Canvas limitations;
- blockers if any.

**Push rule:**

Push to GitHub only once after all chunks are complete or blockers are documented.
