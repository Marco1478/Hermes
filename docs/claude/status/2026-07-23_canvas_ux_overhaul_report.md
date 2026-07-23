# Canvas UX overhaul — final report

Executed from `docs/claude/2026-07-23_0046_CLAUDE_INSTRUCTIONS_007.md`
("Claude Instructions 007 — Fullscreen Workspaces and Canvas UX Overhaul"),
chunks CLAUDE-001 through CLAUDE-009. All nine committed individually and
verified in a live browser before moving on; this is the single final push.

## What changed

**Fullscreen workspace mode (CLAUDE-002).** Notes, Projects, Project
Workspace, and Canvas now use the page's full width. The Project Workspace
gained its own collapsible internal sidebar (independent of the global rail's
own collapse state). The Canvas inspector became a floating drawer
(`position: absolute` inside the viewport) instead of a permanently-reserved
grid column — this reclaims ~300px of board width and, as a side effect,
more robustly fixes an older reflow-jump bug than the previous fix did.

**Explicit interaction modes (CLAUDE-003).** Canvas now has Select / Pan /
Connect / Text / Shape modes with visible buttons, keyboard shortcuts
(V/H/C/T/R), and hold-Space-to-pan. Previously the only way to connect two
nodes was the undiscoverable "drag from a selected node's dot," and there
was no way to pan without landing exactly on empty canvas.

**Redesigned surface (CLAUDE-004).** Richer grid background with depth, a
real zoom/coordinate HUD (–/+/reset, bottom-left), a grouped toolbar with
larger buttons, a sectioned (not cramped-form) inspector, and a proper
empty-state card with direct actions instead of a passive placeholder
paragraph.

**Node UX polish (CLAUDE-005).** Bigger default sizes/fonts, double-click
inline title/body editing directly on text/sticky/card/decision/circle
nodes, larger resize/connector handles, and more visually distinct presets
(text nodes read as a dashed floating label; reference-backed nodes get a
left accent bar).

**Asset references without fake upload (CLAUDE-006).** A new read-only
`/local/obsidian/assets/list` endpoint lists what's actually in a project's
`assets/` vault folder (filenames only — there is still no upload route on
this backend). The inspector's image/file fields gained a "browse project
assets" picker backed by that real listing. Dropping a URL onto the canvas
creates an image node with it; dropping a real OS file shows an honest
"no upload endpoint" banner instead of pretending to import it.

**Micro-feedback (CLAUDE-007).** New reusable `useToasts()` / `<ToastStack/>`
(`src/components/ui/Toast.jsx`) for node added/duplicated/deleted, edge
connected/removed, snap on/off, undo/redo. A separate, non-toast save-state
label (`saving…` / `saved` / `save failed`) handles the debounced-save case
so edits don't spam a toast queue.

**Persistence hardening (CLAUDE-008).** Canvas JSON is now validated/coerced
on both write and read (`sanitizeCanvasRecord` in `hermesBridge.js`) — a
malformed request body can't corrupt the file on disk, and a corrupt or
oddly-shaped file already on disk can't crash the editor; it opens as an
empty canvas with a visible "⚠ invalid JSON in file" flag in the canvas
list instead. The smoke test was extended to cover nodes+edges+asset-ref
round-tripping and the new assets listing endpoint.

## UX frictions fixed

- Canvas board was cramped by three stacked space-thieves (global rail +
  project sidebar + inspector-as-permanent-column).
- Connecting two nodes was only possible by accident; panning required
  landing exactly on empty canvas.
- No way to edit a node's text without opening the inspector drawer.
- Image/file nodes gave no feedback on whether a pasted path actually
  resolved to anything.
- Canvas silently saved (or silently failed to save) with zero feedback.
- A corrupt canvas file would have crashed the editor with no path to
  recovery.

## Build / smoke / browser QA results

- `npm run build`: passing after every chunk, and again as the final check.
- `npm run smoke`: **45/45 checks passed**, including the newly-added
  nodes/edges/asset-ref round-trip and the new `assets/list` check, ending
  with confirmed cleanup ("no test project/canvas/workflow/note left in
  real vault").
- Browser QA at desktop width: Notes and Projects fullscreen workspaces,
  Project Workspace (including the real "Portfolio" project — opened
  read-only, not modified), Canvas empty state, Canvas populated state
  (own disposable test canvases across every chunk), drag/pan/zoom/connect/
  resize/inline-edit/undo/redo, and asset URL/reference behavior (URL drop,
  file drop honest-rejection, plain-text drop, project-assets browse) — all
  verified working, all via real interaction, not just code review.
- Browser QA at tablet (768px) and mobile (375px): no horizontal page
  overflow (confirmed via `scrollWidth` checks, not just visual
  inspection), toolbar/mode-bar wrap cleanly into readable rows, inspector
  drawer overlays rather than crushing the board's own width.
- Console: zero JS errors observed across every chunk's verification pass,
  including on the real "Portfolio" canvas (confirms the redesign is
  backward-compatible with existing vault data, not just newly-created
  test data).
- One real bug was caught and fixed **only because of live interaction
  testing** (a passing build did not catch it): pressing Escape from inside
  the new inline-edit title/body fields bubbled past the local handler to
  PageShell's own global Escape-to-home listener and navigated all the way
  to the hero page instead of just closing the edit box. Fixed with
  `e.stopPropagation()` in the inline-edit handlers — see the comment at
  `NodeInlineEdit` in `src/components/projects/canvas/ProjectCanvas.jsx`.
- A second real bug: a toast side-effect (`pushToast`) was briefly placed
  *inside* a `setSnapEnabled` state-updater function, which React's
  StrictMode double-invokes in dev to catch exactly this — it double-fired
  the toast. Fixed by moving the toast call out to a plain statement in the
  click handler.

## Remaining Canvas limitations

- **No real file upload.** This backend has no route that accepts binary
  bytes — every "asset" is either a public `https://` URL (previews live)
  or a reference to a file that's *already* in the vault's `assets/`
  folder (browsable, but not openable/previewable from the browser, since
  the browser can't reach the vault filesystem directly). This is by
  design per the instruction file ("never pretend a file was uploaded if
  it was not written to vault"), not an oversight.
- Toasts and the save-state label are Canvas-local (`useToasts()` is called
  once inside `CanvasEditor`); nothing else in the app uses them yet. The
  hook/component pair is written to be reusable elsewhere without changes.
- The empty project's `assets/` folder was the only one exercised live
  (smoke test + manual "browse project assets" check) — a folder with many
  files, or unusual filenames, hasn't been tested.

## Blockers

None. All nine chunks completed and verified.

## Housekeeping note (not part of this pass's scope)

`HERMES_UI_QA_DELETE_ME` — a "Temporary browser QA project" — was already
sitting in the active projects list before this instruction file's
execution began (not created by any of CLAUDE-001 through CLAUDE-009). It
was left untouched rather than archived, since it predates this session's
work and its origin wasn't something this pass could verify. Marco may
want to archive it separately if it's no longer needed.
