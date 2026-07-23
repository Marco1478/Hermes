# Claude Instructions 008 — Canvas Consolidation, Real Asset Uploads, and Horizontal Fullscreen Workspace

## Context

Marco reviewed the latest Canvas work. The Canvas improved, but it is still not usable enough. This pack must consolidate the Canvas experience instead of adding scattered features.

Marco's concrete feedback:

- The workspace/canvas feels more fullscreen vertically, but **not horizontally**.
- When entering a Project Workspace, there is an awkward empty gap between the main navbar and the project navbar/sidebar.
- Fullscreen must mean full available workspace in **all directions**, not just height.
- In Canvas, dragging sometimes selects/highlights text instead of dragging.
- Drag does not perfectly follow the cursor path.
- The decision node is completely black / unreadable.
- The quick commands at the top do not seem to work.
- Connecting cards feels unnatural.
- Canvas still needs a strong consolidation pass because it is not very usable yet.
- Real asset upload is desired: images, video, documents, audio.
- File size limit should be chosen pragmatically; default to a sustainable limit and resize/compress images when feasible.
- If upload/file support is blocked by backend/bridge constraints, document the blocker clearly in a commit/report. Do not fake upload.

## Product North Star

The Project Workspace and Canvas should feel like a full-screen creative operating surface:

```text
no wasted horizontal gaps
no centered-window feeling
no tiny technical handles
no text selection during drag
no unreadable black nodes
no fake upload
no silent broken shortcuts
no awkward connector ritual
```

Target:

```text
full-width workspace
quiet global navigation
dominant project workspace
huge canvas board
smooth direct manipulation
clear interaction modes
real asset persistence in Obsidian vault
honest failure states
```

## Operating Rules

- Work chunks in numeric order unless blocked and a later chunk is independent.
- Verify each chunk before moving to the next.
- Commit locally after each verified chunk.
- Push to GitHub only once after the whole file is complete or blockers are documented.
- Do not commit `.env.local`, secrets, private vault content, user files, generated QA artifacts, or personal notes/projects.
- Do not fake upload, asset persistence, drag/drop behavior, shortcut behavior, backend writes, or previews.
- Visual UX work requires browser QA. A passing build is not proof.
- Preserve prior features:
  - Obsidian-backed notes/projects;
  - project workspaces;
  - custom canvas JSON;
  - nodes/edges;
  - undo/redo;
  - asset reference nodes;
  - project chat;
  - project Kanban.

---

## CLAUDE-001 — Audit current fullscreen and Canvas failure points in browser

**Objective:**

Before editing, reproduce Marco's complaints directly in the browser and use them as the acceptance target.

**Files likely involved:**

- no code changes required unless adding a status artifact
- `src/components/PageShell.jsx`
- `src/components/PageShell.css`
- `src/components/projects/ProjectsPage.jsx`
- `src/components/projects/ProjectsPage.css`
- `src/components/projects/ProjectWorkspace.jsx`
- `src/components/projects/canvas/ProjectCanvas.jsx`
- `src/components/projects/canvas/ProjectCanvas.css`

**Audit checklist:**

- Open a Project Workspace and inspect horizontal space usage.
- Identify the gap between global navbar/rail and project navigation.
- Open Canvas and inspect if it fills width, not only height.
- Try dragging multiple nodes and confirm whether text selection occurs.
- Observe whether node drag tracks the cursor exactly.
- Create/select a decision node and check readability.
- Test top quick commands/shortcuts and note which do not work.
- Connect two cards and judge whether the flow is natural.
- Record which interactions feel legnosa / awkward.

**Verification gate:**

- The final report must include a short "Before" list of observed UX failures.
- Do not proceed from assumptions alone.

**Commit rule:**

No commit required for pure audit. If a status note is created, commit with:

```text
docs: record canvas consolidation audit
```

---

## CLAUDE-002 — Fix horizontal fullscreen workspace layout and remove nav gap

**Objective:**

Make Notes/Projects/Project Workspace full-screen in both axes. Solve the wasted horizontal space and awkward gap between global navigation and project navigation.

**Files likely involved:**

- `src/components/PageShell.jsx`
- `src/components/PageShell.css`
- `src/components/PageNav.jsx`
- `src/components/PageNav.css`
- `src/components/projects/ProjectsPage.jsx`
- `src/components/projects/ProjectsPage.css`
- `src/components/projects/ProjectWorkspace.jsx`
- `src/components/projects/ProjectWorkspace.css` if present
- `src/state/RailCollapse.jsx`
- `src/App.jsx`

**Implementation notes:**

- Fullscreen must mean:
  - full available height;
  - full available width;
  - minimal outer margins;
  - no centered content box for Projects/Project Workspace/Canvas.
- Remove or redesign the empty gap between the global nav and project nav.
- Options to consider:
  - auto-collapse the global rail when inside Project Workspace;
  - overlay/compact the global nav into a slim command strip;
  - merge back/navigation into the project sidebar header;
  - make project sidebar attach flush to the app rail with no dead space;
  - create a dedicated `workspace-shell` layout that bypasses the normal page card constraints.
- Project Workspace should become the dominant layout surface.
- Canvas should receive maximum horizontal board width.
- Keep a clear way back to Projects/home; do not trap the user.

**Acceptance target:**

Desktop Project Workspace should feel like:

```text
[quiet/slim global nav][project sidebar][huge live workspace]
```

Not:

```text
[global nav]   [random gap]   [small centered workspace card]
```

**Verification gate:**

- Browser QA confirms no dead horizontal gap between app nav and project nav.
- Projects and Project Workspace fill screen width naturally.
- Canvas board gains actual horizontal room.
- No horizontal overflow at desktop/tablet/mobile.
- Build passes.
- Console zero errors.

**Commit rule:**

Commit when verified with:

```text
fix: make project workspaces truly fullscreen
```

---

## CLAUDE-003 — Fix Canvas drag: no text selection, exact cursor tracking, smooth gestures

**Objective:**

Dragging nodes must feel physically correct. It must not highlight text, drift from the cursor, duplicate nodes, or feel nervous.

**Files likely involved:**

- `src/components/projects/canvas/ProjectCanvas.jsx`
- `src/components/projects/canvas/ProjectCanvas.css`
- possible canvas interaction helpers

**Implementation notes:**

Fix:

- text selection during node drag;
- cursor/node offset mismatch;
- drag not following pointer path exactly;
- accidental duplicate/selection during drag;
- conflict between drag, resize, connector, inline editing.

Requirements:

- Use correct pointer capture / drag controls.
- Apply `user-select: none` only to non-editing drag surfaces, not globally.
- Add drag threshold so clicks are not mistaken for drags.
- Prevent text selection while dragging canvas/nodes.
- Text inside editable fields must remain editable/selectable when in edit mode.
- Node should remain visually locked to cursor while dragging, including after zoom/pan if supported.
- Verify at different zoom levels if Canvas supports zoom.

**Verification gate:**

- Drag text node repeatedly: no text highlight.
- Drag decision node repeatedly: no text highlight.
- Drag after zoom/pan: node follows cursor correctly.
- Resize handle does not trigger drag.
- Connector handle/mode does not trigger drag.
- Inline text edit still allows text selection/editing.
- Build passes.
- Console zero errors.

**Commit rule:**

Commit when verified with:

```text
fix: stabilize canvas drag interactions
```

---

## CLAUDE-004 — Fix decision node readability and all node preset contrast

**Objective:**

No node preset may become unreadable. The decision node currently appears black/unreadable and must be fixed.

**Files likely involved:**

- `src/components/projects/canvas/ProjectCanvas.jsx`
- `src/components/projects/canvas/ProjectCanvas.css`
- node preset definitions/helpers if present

**Implementation notes:**

- Fix decision node contrast immediately.
- Content inside diamond/decision shapes must remain upright and readable.
- Avoid pure-black fills on dark backgrounds unless text/card contrast is mathematically clear.
- Each preset must have:
  - readable text;
  - visible border;
  - selected state;
  - hover state;
  - editable state;
  - enough padding.
- Presets should feel visually distinct but coherent:
  - text card;
  - sticky;
  - decision;
  - process;
  - image;
  - video;
  - audio;
  - document;
  - file/reference;
  - checklist.

**Verification gate:**

- Create each preset.
- Readability verified on dark background.
- Decision node readable in default, hover, selected, and editing state.
- No white browser-native UI fragments.
- Build passes.
- Console zero errors.

**Commit rule:**

Commit when verified with:

```text
fix: improve canvas node preset readability
```

---

## CLAUDE-005 — Make quick commands real and visible, or remove/replace broken affordances

**Objective:**

The quick commands at the top currently do not appear to work. Every visible command must either work or be replaced with honest disabled/diagnostic UI.

**Files likely involved:**

- `src/components/projects/canvas/ProjectCanvas.jsx`
- `src/components/projects/canvas/ProjectCanvas.css`
- command/shortcut helpers if present
- shared toast/feedback components

**Implementation notes:**

- Audit every top quick command/button.
- For each command:
  - confirm click behavior;
  - confirm keyboard shortcut if shown;
  - confirm visual feedback;
  - confirm no console errors.
- If command cannot be implemented safely now:
  - remove it;
  - or mark disabled with a precise tooltip;
  - or convert to a non-clickable hint.
- Do not leave dead buttons.
- Add a small shortcut/help overlay if useful.

**Expected commands to validate:**

- select/move;
- pan;
- connect;
- add text;
- add shape;
- add asset;
- undo;
- redo;
- snap;
- zoom in/out/reset;
- delete selected if present.

**Verification gate:**

- Each visible command tested by click.
- Each visible shortcut tested if advertised.
- Broken/unsupported commands removed or made honest.
- Build passes.
- Console zero errors.

**Commit rule:**

Commit when verified with:

```text
fix: make canvas quick commands reliable
```

---

## CLAUDE-006 — Redesign card connection UX so it feels natural

**Objective:**

Connecting cards must stop feeling like a small technical ritual. It should be obvious, forgiving, and visually satisfying.

**Files likely involved:**

- `src/components/projects/canvas/ProjectCanvas.jsx`
- `src/components/projects/canvas/ProjectCanvas.css`
- edge/connector helpers if present

**Implementation notes:**

Improve connection UX:

- Add explicit Connect mode.
- Show clear source selection.
- Highlight valid target cards while connecting.
- Show a live preview line following the cursor.
- Use larger hit areas.
- Allow connection through:
  - toolbar connect mode;
  - selected node connector affordance;
  - maybe keyboard shortcut `C`.
- On invalid drop/cancel, show subtle feedback.
- Edges should be easy to select/delete.
- Edge labels/types are optional, only add if stable.

**Verification gate:**

- Connect node A -> node B using connect mode.
- Connect via node affordance if kept.
- Invalid target/cancel gives feedback.
- Edge preview follows cursor.
- Edge persists after reload.
- Edge delete works.
- Build passes.
- Console zero errors.

**Commit rule:**

Commit when verified with:

```text
feat: improve canvas card connection UX
```

---

## CLAUDE-007 — Implement real asset upload into project vault assets

**Objective:**

Canvas must support real upload/persistence for assets, not just URL/reference cards.

**Files likely involved:**

- `src/components/projects/canvas/ProjectCanvas.jsx`
- `src/components/projects/canvas/ProjectCanvas.css`
- `src/lib/obsidianBridge.js`
- `vite-plugins/obsidianBridge.js`
- `src/state/Projects.jsx`
- `scripts/smoke-backend.mjs`
- maybe new asset helper files

**Supported file categories:**

- Images:
  - `png`, `jpg`, `jpeg`, `webp`, `gif`, `svg`
- Video:
  - `mp4`, `webm`, `mov` if browser/backend supports preserving safely
- Audio:
  - `mp3`, `wav`, `ogg`, `m4a`
- Documents:
  - `pdf`, `md`, `txt`, and `docx` if safe to store as opaque file reference

**Size policy:**

Choose a sustainable default. Recommended:

```text
25 MB max per file
```

Image policy:

- If feasible, resize/compress oversized images before storing.
- Suggested maximum long edge: `4096px`.
- If resizing is not safely feasible in this pass, enforce the size limit and document image resize as a future improvement.

Video/audio policy:

- Do not transcode in this pass.
- Store if within size/type limits.
- Show clear error if too large.

Document policy:

- Store as file/reference asset.
- Do not promise parsing PDF/DOCX content unless actually implemented.

**Persistence target:**

Assets must be written into:

```text
Hermes/Projects/<Project>/assets/
```

Canvas JSON should store relative refs, for example:

```json
{
  "type": "asset",
  "assetPath": "assets/reference-video.mp4",
  "mediaType": "video"
}
```

**Security requirements:**

- Prevent path traversal.
- Sanitize filenames.
- Avoid overwriting existing assets silently; dedupe filenames if necessary.
- Do not commit uploaded test files.
- Do not print binary/file contents into logs.

**If blocked:**

If browser/Vite bridge/backend cannot support actual file upload in this pass, create a blocker note and commit it. The UI must show an honest diagnostic. Do not fake success.

**Verification gate:**

- Upload image -> file appears in project `assets/`, image node preview works.
- Upload document -> file appears in `assets/`, document node/card shows name/path/type.
- Upload audio -> file appears in `assets/`, audio card/player if feasible.
- Upload video -> file appears in `assets/`, video card/player if feasible.
- Oversized file rejected with readable message.
- Unsupported file rejected with readable message.
- Reload confirms asset refs persist.
- Build passes.
- Console zero errors.

**Commit rule:**

Commit when verified with:

```text
feat: add real canvas asset uploads
```

---

## CLAUDE-008 — Build a project asset library panel for Canvas

**Objective:**

Uploaded assets should not disappear into the filesystem. They need a visible project asset library usable from Canvas.

**Files likely involved:**

- `src/components/projects/canvas/ProjectCanvas.jsx`
- `src/components/projects/canvas/ProjectCanvas.css`
- `src/lib/obsidianBridge.js`
- `vite-plugins/obsidianBridge.js`
- asset helper components

**Implementation notes:**

- Add an asset library drawer/panel in Canvas.
- Show assets grouped or filterable by:
  - images;
  - video;
  - audio;
  - documents;
  - other files.
- Each asset card should show:
  - filename;
  - type;
  - size;
  - preview thumbnail/player icon where feasible;
  - path/reference.
- User should be able to:
  - upload asset;
  - drag asset onto canvas to create a node;
  - click to insert asset node;
  - copy/reference path if useful.
- If listing assets is blocked, document clearly.

**Verification gate:**

- Asset library lists uploaded test assets.
- Drag/click creates asset nodes.
- Assets persist after reload.
- Empty library state useful.
- Build passes.
- Console zero errors.

**Commit rule:**

Commit when verified with:

```text
feat: add canvas asset library
```

---

## CLAUDE-009 — Consolidate Canvas save/status feedback and error handling

**Objective:**

The Canvas must communicate what happened. No silent saves, no dead clicks, no hidden upload failures.

**Files likely involved:**

- `src/components/projects/canvas/ProjectCanvas.jsx`
- `src/components/projects/canvas/ProjectCanvas.css`
- shared toast/status components if present
- `src/lib/obsidianBridge.js`
- `vite-plugins/obsidianBridge.js`

**Implementation notes:**

Add or refine feedback for:

- saving;
- saved;
- save failed;
- upload started;
- upload completed;
- upload failed;
- file too large;
- unsupported file;
- node created;
- edge created;
- invalid connection;
- command executed;
- command disabled;
- undo/redo.

Requirements:

- Feedback should be visible but not noisy.
- Do not spam while dragging/resizing.
- Save writes should be debounced or gesture-end based.
- Errors must remain readable long enough.
- Console errors should be reserved for real unexpected failures, not normal unsupported user actions.

**Verification gate:**

- Trigger each major success/failure case.
- Confirm visible feedback.
- Confirm no toast spam during drag.
- Build passes.
- Console zero errors.

**Commit rule:**

Commit when verified with:

```text
fix: improve canvas status feedback
```

---

## CLAUDE-010 — Smoke coverage, browser QA, report, and one final push

**Objective:**

Verify the consolidation work with real evidence and push once.

**Required checks:**

- `npm run build` passes.
- `npm run smoke` passes, or exact blocker documented.
- Browser QA desktop:
  - Project Workspace fullscreen horizontal layout;
  - no gap between nav surfaces;
  - Canvas full-width board;
  - node drag no text selection;
  - drag follows cursor;
  - decision node readable;
  - quick commands work or are honest;
  - connection UX natural;
  - asset upload/list/insert;
  - save/status feedback.
- Browser QA tablet/narrow:
  - no horizontal overflow;
  - workspace still navigable;
  - asset library/inspector usable.
- Real vault checks:
  - uploaded test files exist in project `assets/`;
  - canvas JSON references them relatively;
  - cleanup removes test project/assets.
- Security scan:
  - no secrets;
  - no `.env.local`;
  - no uploaded binaries committed;
  - no private vault content committed.

**Final report:**

Create:

```text
docs/claude/status/YYYY-MM-DD_canvas_consolidation_asset_upload_report.md
```

Include briefly:

- fullscreen layout changes;
- drag/connector/decision-node fixes;
- asset upload implementation status;
- size/type policy;
- build/smoke/browser results;
- blockers if any;
- remaining UX debt.

**Push rule:**

Push to GitHub only once after all chunks are complete or blockers are documented.
