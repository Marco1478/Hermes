# Canvas Consolidation & Real Asset Upload — Final Report

Executed from `docs/claude/2026-07-23_0934_CLAUDE_INSTRUCTIONS_008.md` (CLAUDE-001
through CLAUDE-010). All ten chunks completed and verified against the real
running app and the real vault; no blockers required deferring any chunk.

## Fullscreen layout changes (CLAUDE-002)

`PageShell` gained an `edge` variant (`page-constrain--edge`, appended after the
existing rail-width media query so it wins the cascade) used by Projects and
Notes in place of `wide`. Confirmed live via `getBoundingClientRect`/computed
styles (not screenshots — see note below) that the project sidebar sits flush
against the main rail with no gap, and the Canvas board fills the remaining
width and height with no page-level horizontal or vertical overflow, at
desktop, tablet (768px), and mobile (375px) widths.

**Note on method:** screenshots in the browser-automation tool are downscaled
at non-native window widths and were found to visually misrepresent where
content actually ends. All "fills available space" / "no gap" / "no overflow"
claims in this report were verified via DOM measurement
(`getBoundingClientRect`, `scrollWidth` vs `clientWidth`), not by eyeballing a
screenshot.

## Drag / connector / decision-node fixes (CLAUDE-003, CLAUDE-004, CLAUDE-006)

- Node drag no longer selects/highlights text (`user-select: none` on
  `.canvas-viewport`, `text` override on the inline-edit box) and tracks the
  cursor exactly — confirmed a real bug here (`dragControls.start(e)` was
  being called after `preventDefault()`, which made framer-motion silently
  ignore the gesture) and fixed the ordering.
- The decision node's solid-black rendering was `backdrop-filter` +
  `clip-path` compositing on the same element; fixed by dropping
  `backdrop-filter` there and using a more opaque flat fill instead.
- A real selected-state CSS bug (teal's border color silently beating
  selected's via source order, both at equal specificity) was found and
  fixed while verifying the decision-node fix.
- Card connection UX redesigned: dragging a connector no longer opens the
  inspector mid-gesture (was obscuring the drop target), a padded hit-test
  is shared identically between the live hover-highlight and the actual
  drop logic so they can't disagree, and a real overlapping-node bug (the
  source node's own bounds shadowing the intended target) was found and
  fixed.
- Quick commands (mode switches, undo/redo, snap, zoom) audited one by one
  in the browser; all work. Zoom +/- at the 40%/200% clamp was a silent
  dead click — now properly `disabled` at the bounds (CLAUDE-009).

## Real asset upload — implementation status (CLAUDE-007)

Fully implemented and end-to-end verified against the real vault, not
mocked or faked at any layer:

- Client encodes the file as base64 and POSTs JSON to
  `/local/obsidian/assets/upload`; server decodes to a `Buffer` and writes
  it through the existing SSH-exec `writeFile` path (already binary-safe
  once given a Buffer instead of a string — confirmed by inspecting
  `stdin.write()`'s behavior, no code change needed there).
- A new binary-safe read-back route (`/local/obsidian/assets/read`, with
  `execRemote`'s `binary: true` mode) streams the real bytes back for
  in-canvas `<img>`/`<video>`/`<audio>` previews.
- Verified live: image upload (`naturalWidth` on the decoded `<img>` matched
  the real uploaded pixel dimensions), video upload, audio upload,
  duplicate-filename dedup (server appends `" (2)"`), oversized-file
  rejection (client + server both enforce the 25MB limit), unsupported-type
  rejection, and reload persistence (uploaded file + working preview
  survive a full page reload and re-navigation).
- A real OS file dropped onto the canvas from Explorer/Finder now genuinely
  uploads through this same route (CLAUDE-008) instead of the previous
  "can't import" message, which had gone stale the moment this route
  shipped.

## Size / type policy

- **Size limit:** 25MB per file (the instruction file's recommended value),
  enforced both client-side (instant feedback) and server-side
  (authoritative — the client check is a convenience, not a security
  boundary).
- **Accepted types:** images (png/jpg/jpeg/webp/gif/svg), video
  (mp4/webm/mov), audio (mp3/wav/ogg/m4a), documents (pdf/md/txt/docx).
  Anything else is rejected with a readable error before any bytes move.
- **Image resize/compression:** deliberately **not implemented** — the
  instruction file explicitly allows deferring this if not safely feasible
  without a new dependency, and this project has no image-processing
  library. Documented here as a known blocker/future improvement rather
  than silently skipped.

## Asset library (CLAUDE-008)

A project-wide asset library drawer in Canvas, separate from the
per-node "reference an existing asset" picker: every real file in the
project's `assets/` folder, filterable by image/video/audio/document/other,
each card showing a genuine thumbnail (or type glyph), real size, and path,
with upload / drag-to-canvas / click-to-insert / copy-path actions. The
`assets/list` route was extended to return real sizes and inferred media
types (previously filenames only) to support this. Verified live: all 4
uploaded test assets listed correctly, filters work, both drag-to-canvas and
click-to-insert create real nodes with correct refs, and the empty state
(checked against a real project with zero uploads) reads clearly instead of
looking broken.

## Status feedback (CLAUDE-009)

Audited every case the instruction file lists (save states, upload
lifecycle, node/edge creation, undo/redo, connection outcomes, command
execution) against the running app. Nearly all of it was already covered
honestly by earlier chunks: save state is a persistent non-spammy
idle/saving/saved/error label rather than a toast per keystroke, drag/resize
collapse to one undo step per gesture instead of firing on every tick
(confirmed live: zero toasts fired across a full synthetic drag gesture),
and errors (upload failures, save failures) stay visible long enough to
read. The one real gap found was the zoom HUD buttons' silent dead click at
their bounds, fixed to match the disabled-button pattern undo/redo already
used.

## Build / smoke / browser results

- `npm run build`: passes clean after every chunk, including the final
  state.
- `npm run smoke`: **45/45 checks passed**, including the extended
  `assets/list` route and vault path-traversal guards.
- Browser QA (desktop, tablet 768px, mobile 375px): fullscreen layout, no
  nav gap, full-width Canvas board, drag without text selection, cursor-
  accurate drag, readable decision node, working quick commands, natural
  connection UX, full asset upload/list/insert flow, and status feedback —
  all confirmed via live interaction (DOM state, not just code review) at
  every width. No horizontal overflow at any tested width.
- Console: zero errors observed throughout every verification pass in this
  session, including the final asset-library and status-feedback checks.

## Real vault checks

- Uploaded test files existed in the real project's `assets/` folder
  (`_HERMES_UI_SMOKE_TEST_DELETE_ME.png`, `.mp3`, `.mp4`, `.txt`, and the
  dedup-tested `(2).png`), confirmed via a direct `assets/list` fetch
  returning `ok:true` with the real filenames, sizes, and inferred types.
- Canvas JSON stores asset refs as vault-relative paths
  (`assets/<filename>`), never absolute paths or embedded data — confirmed
  by inspecting the node `ref.url` values created by both upload and the
  asset library's insert/drag flows.
- Cleanup: the test project (`_HERMES_UI_SMOKE_TEST_DELETE_ME consolidation`,
  created earlier in this same execution run for chunk-by-chunk testing)
  was archived via the app's own archive UI, which moves the entire project
  folder — including its `assets/` subfolder and every test canvas inside
  it — out of the active `projects/` directory in one operation. Confirmed
  post-archive: the project no longer appears in the active projects list,
  and `assets/list` against its old path now returns empty (the folder no
  longer exists there). Consistent with this codebase's "archiving always
  moves, never deletes" design — nothing was hard-deleted.
- The pre-existing `HERMES_UI_QA_DELETE_ME` project (not created by this
  execution) was left untouched, as flagged in an earlier session.

## Security scan

- No secrets, API keys, or credentials in any commit's diff (checked via
  pattern grep against the full `origin/main..HEAD` diff).
- No `.env.local` tracked — only the pre-existing `.env.local.example`
  template.
- No uploaded test binaries (the PNG/MP3/MP4/TXT test files) committed —
  they only ever existed in the real vault (and are now archived there),
  never in this git repo.
- No private vault content (notes, project descriptions, real asset bytes)
  committed — every commit this run touched only source code, CSS, and this
  status-report doc.

## Blockers

None that stopped a chunk from completing. The one deferred item (image
resize/compression) was explicitly pre-authorized as deferrable by the
instruction file and is documented above and under remaining UX debt.

## Remaining UX debt

- **Image resize/compression on upload:** not implemented (see size/type
  policy above). Would need an image-processing dependency this project
  doesn't currently have.
- **No delete/remove-asset action:** the asset library can list, insert,
  and reference assets, but there's no UI to delete an asset from the
  vault once uploaded (matches the existing notes/projects/canvases pattern
  of "archive, never hard-delete" — but assets currently have no equivalent
  archive path of their own, since they're not first-class records the way
  notes/projects/canvases are).
- **No multi-file upload/drag:** both the upload button and OS file drop
  handle exactly one file per action.
- **Video/audio thumbnails are a static glyph, not a generated frame/
  waveform preview** — matches "player icon where feasible" from the
  instruction file, but a real frame-grab preview would be a nicer future
  version.
- **Zoom-reset button** has no disabled state when already at the default
  view (100%, no pan) — a very low-severity idempotent no-op, left as-is
  rather than over-engineered.

## Commits (this execution, oldest to newest)

```text
b8860f2 docs: record canvas consolidation audit
fc629c3 fix: make project workspaces truly fullscreen
601fd53 fix: stabilize canvas drag interactions
4eb7851 fix: improve canvas node preset readability
b5def07 fix: make canvas quick commands reliable
296e787 feat: improve canvas card connection UX
ccbf17a feat: add real canvas asset uploads
39fb93f feat: add canvas asset library
8c2cf62 fix: improve canvas status feedback
```

Pushed to GitHub as a single push after this report's commit, per the
instruction file's push rule.
