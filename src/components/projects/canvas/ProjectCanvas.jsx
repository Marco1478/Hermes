import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useDragControls } from "framer-motion";
import { useNotes } from "../../../state/Notes.jsx";
import { useViewMode } from "../../../state/ViewMode.jsx";
import { fetchVaultCanvases, writeVaultCanvas, archiveVaultCanvas, fetchProjectAssets, uploadProjectAsset, assetReadUrl, logProjectActivity } from "../../../lib/obsidianBridge.js";
import { parseTagsInput } from "../../../lib/tags.js";
import { GlassButton } from "../../ui/GlassButton.jsx";
import { GlassToolbar } from "../../ui/GlassToolbar.jsx";
import { useToasts, ToastStack } from "../../ui/Toast.jsx";
import "./ProjectCanvas.css";

const NODE_TYPES = [
  { key: "text", label: "Text", glyph: "T" },
  { key: "sticky", label: "Sticky note", glyph: "◇" },
  { key: "card", label: "Card", glyph: "▭" },
  { key: "decision", label: "Decision", glyph: "◆" },
  { key: "circle", label: "Circle", glyph: "●" },
  { key: "checklist", label: "Checklist", glyph: "☑" },
  { key: "image", label: "Image", glyph: "🖼" },
  { key: "video", label: "Video", glyph: "🎬" },
  { key: "audio", label: "Audio", glyph: "🎵" },
  { key: "file", label: "File ref", glyph: "📄" },
  { key: "note", label: "Note ref", glyph: "🔗" },
  { key: "kanban", label: "Kanban ref", glyph: "▤" },
];

// Grouped purely for toolbar presentation (CLAUDE-004) — same NODE_TYPES
// data, just clustered so the toolbar reads as "notes / shapes / structure
// / media / references" instead of one flat row of buttons.
const NODE_GROUPS = [
  { label: "Notes", keys: ["text", "sticky", "card"] },
  { label: "Shapes", keys: ["decision", "circle"] },
  { label: "Structure", keys: ["checklist"] },
  { label: "Media", keys: ["image", "video", "audio"] },
  { label: "References", keys: ["file", "note", "kanban"] },
];

// Real upload support (CLAUDE-007) — extensions accepted per media type,
// mirrored from the server's own allow-list (vite-plugins/hermesBridge.js)
// so a client-side reject happens instantly instead of round-tripping to
// the server just to be told no. Kept as the single source of truth for
// both the file-picker's `accept` attribute and the pre-upload check.
const ASSET_EXTENSIONS = {
  image: ["png", "jpg", "jpeg", "webp", "gif", "svg"],
  video: ["mp4", "webm", "mov"],
  audio: ["mp3", "wav", "ogg", "m4a"],
  file: ["pdf", "md", "txt", "docx"],
};
const ASSET_MAX_BYTES = 25 * 1024 * 1024;
const ALL_ASSET_EXTENSIONS = Object.values(ASSET_EXTENSIONS).flat();

// Asset library (CLAUDE-008) — filters use the server's mediaType vocabulary
// (image/video/audio/document, see assetMediaType in hermesBridge.js) plus
// "other" for a real file sitting in assets/ whose extension this build
// doesn't recognize (e.g. dropped in directly via Obsidian, not through
// Upload) — that file still exists and should still be visible, just
// unfiltered into any of the known buckets.
const ASSET_LIBRARY_FILTERS = [
  { key: "all", label: "All" },
  { key: "image", label: "Images" },
  { key: "video", label: "Video" },
  { key: "audio", label: "Audio" },
  { key: "document", label: "Documents" },
  { key: "other", label: "Other" },
];

function formatAssetSize(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function assetGlyph(mediaType) {
  if (mediaType === "image") return "🖼";
  if (mediaType === "video") return "🎬";
  if (mediaType === "audio") return "🎵";
  if (mediaType === "document") return "📄";
  return "📁";
}

// The library's mediaType vocabulary (image/video/audio/document/null) maps
// onto a smaller set of Canvas node types — there's no separate "document"
// node type, "file" already covers any vault-relative reference generically
// (see its inspector section), so document AND unrecognized-other both land
// there.
function mediaTypeToNodeType(mediaType) {
  if (mediaType === "image") return "image";
  if (mediaType === "video") return "video";
  if (mediaType === "audio") return "audio";
  return "file";
}

const COLORS = ["teal", "warn", "bad", "ok", "violet"];
const GRID = 20;
const MIN_W = 130;
const MIN_H = 90;
const MAX_HISTORY = 50;

// Types whose content is a plain title+body (NodeContent's fallback branch)
// support inline double-click editing directly on the node — the ref-backed
// types (image/file/note/kanban/checklist) have structured fields that
// don't reduce to "edit some text in place", so those stay inspector-only.
const INLINE_EDIT_TYPES = ["text", "sticky", "card", "decision", "circle"];

// Explicit interaction modes (CLAUDE-003) — Select/Move stays the default
// and the connector dot / resize handle keep working exactly as before
// regardless of mode; these are for the actions that used to be
// discoverable only by accident (drag-a-node-to-connect once selected) or
// not at all (no way to pan without landing exactly on empty canvas, no
// quick "just place a card/text here"). Space held down temporarily
// switches to Pan and reverts on release — see CanvasEditor's keydown
// effect — same as every mainstream design tool.
const MODES = [
  { key: "select", label: "Select", shortcut: "V", hint: "Select & move (drag) — default" },
  { key: "pan", label: "Pan", shortcut: "H", hint: "Drag anywhere to pan — or just hold Space" },
  { key: "connect", label: "Connect", shortcut: "C", hint: "Click a node, drag to another to connect them" },
  { key: "text", label: "Text", shortcut: "T", hint: "Click empty canvas to drop a text note there" },
  { key: "shape", label: "Shape", shortcut: "R", hint: "Click empty canvas to drop a card there" },
];

// Every OTHER keyboard shortcut the editor responds to, for the same help
// popover (CLAUDE-005) — modes aren't the only thing worth listing here;
// without this, undo/redo/delete/zoom were only ever discoverable one at a
// time via individual button tooltips, never as a single reference.
const OTHER_SHORTCUTS = [
  { label: "Undo", shortcut: "Ctrl/Cmd+Z", hint: "Undo the last structural change" },
  { label: "Redo", shortcut: "Ctrl/Cmd+Shift+Z", hint: "Redo what you just undid" },
  { label: "Delete node", shortcut: "Delete / Backspace", hint: "Remove the selected node" },
  { label: "Zoom in / out", shortcut: "Scroll", hint: "Or the –/+ buttons in the bottom-left HUD" },
  { label: "Deselect / cancel", shortcut: "Esc", hint: "Clears selection, exits mode/edit — press again to go home" },
];

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function newNode(type, x, y) {
  const bigger = type === "circle" || type === "decision";
  return { id: uid(), type, x, y, w: type === "decision" ? 260 : 240, h: bigger ? 180 : 150, title: "", body: "", color: "teal", tags: [], checklist: [], ref: null };
}

function snap(value, enabled) {
  return enabled ? Math.round(value / GRID) * GRID : value;
}

// A little forgiveness on the drop target (CLAUDE-006) — landing a pointer
// on the exact pixel of another node's edge is fiddly, especially at low
// zoom, and missing by one pixel used to silently do nothing. This same
// padded hit-test drives BOTH the live "valid target" highlight while
// dragging a connection AND the actual drop-target check on release, so
// what visually lights up as connectable is always exactly what connects.
const CONNECT_HIT_PADDING = 14;
function nodeContainsPoint(n, x, y, padding = 0) {
  return x >= n.x - padding && x <= n.x + n.w + padding && y >= n.y - padding && y <= n.y + n.h + padding;
}

function NodeShell({ node, zoom, mode, selected, isConnectSource, isConnectTarget, onSelect, onDrag, onDragStart, onStartConnect, onResizeStart, onStartEdit, children }) {
  // Position is authoritatively left/top (React state, persisted to the
  // vault) — x/y are ONLY the live, uncommitted offset of an in-progress
  // drag gesture. Without owning these motion values explicitly and
  // zeroing them after every commit, framer keeps whatever x/y a drag
  // gesture last accumulated internally and keeps applying it as an
  // ADDITIONAL transform on top of left/top on every future render — so
  // a node whose position changes via undo/redo/another drag (anything
  // other than a fresh mount) silently renders offset from its real
  // position. Confirmed live via getBoundingClientRect() during QA: a
  // plain animate={{x:0,y:0}} did NOT reliably clear it (framer treats
  // an unchanged literal target as nothing-to-do even when the actual
  // motion value has drifted) — explicit MotionValues + an effect that
  // unconditionally re-zeros them after each commit is what actually
  // holds.
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const draggingRef = useRef(false);
  // dragListener={false} + manually calling dragControls.start() from our
  // OWN onPointerDown is the fix for the connector dot / resize handle
  // hijacking the card drag (and, transitively, the "sometimes duplicates
  // a card" bug that traced back to it): by default `drag` attaches its
  // own NATIVE pointerdown listener directly to this element, which fires
  // during real DOM bubbling from the connector/resize handle's own
  // pointerdown BEFORE React's synthetic e.stopPropagation() in their
  // handlers ever runs — so stopPropagation() there could never actually
  // stop it. Routing drag-start through dragControls makes it just another
  // React-mediated call, so a child's stopPropagation() genuinely prevents
  // it, same pattern already used for column-drag in KanbanColumn.jsx.
  const dragControls = useDragControls();

  useEffect(() => {
    if (draggingRef.current) return;
    x.set(0);
    y.set(0);
  }, [node.x, node.y, x, y]);

  // Mode governs what a plain pointerdown on the node body DOES — the
  // connector dot and resize handle below are unconditional (they stop
  // their own propagation and always mean "connect"/"resize" regardless
  // of mode, since they're an explicit deliberate target either way).
  const onNodePointerDown = (e) => {
    if (mode === "pan") return; // don't select/drag — let it bubble to the viewport's own pan handler
    if (mode === "connect") {
      e.stopPropagation(); // a node click in Connect mode must never also reach the background pan handler
      // Deliberately NOT onSelect(node.id) here (CLAUDE-006) — that opens
      // the full editing inspector as a side effect, which then floats on
      // top of the board and can cover the very target node you're trying
      // to drag onto (confirmed live: dragging toward an overlapping node
      // was untestable because the inspector drawer sat directly over it).
      // isConnectSource (derived from `connecting.fromId`, see CanvasEditor)
      // already gives the source its own distinct pulsing highlight below
      // — that's the "clear source selection" this mode needs, without the
      // inspector's screen-space cost.
      onStartConnect(node.id, e);
      return;
    }
    // select / text / shape modes: clicking an EXISTING node always just
    // selects+drags it (text/shape modes only change what an EMPTY-canvas
    // click does — see CanvasEditor's onBackgroundPointerDown).
    onSelect(node.id);
    dragControls.start(e);
    // preventDefault AFTER dragControls.start(), not before — framer's own
    // gesture engagement silently no-ops on an already-defaultPrevented
    // event (confirmed live: calling this first made drags stop moving
    // the node at all, ~99% of the requested delta just vanished). Called
    // here, it still successfully suppresses the native text-selection
    // that a pointerdown-then-move landing on rendered text would
    // otherwise start (confirmed live too: window.getSelection() returned
    // the node's own title text after a drag before this existed at all),
    // it just has to happen after framer has already read the event.
    e.preventDefault();
  };

  // Double-click drops into inline editing (title/body directly on the
  // node) instead of requiring a trip to the inspector — only meaningful
  // in Select mode, since Connect/Text/Shape/Pan double-clicks already
  // mean something else (or nothing) there.
  const onNodeDoubleClick = (e) => {
    if (mode !== "select" || !onStartEdit) return;
    e.stopPropagation();
    onSelect(node.id);
    onStartEdit(node.id);
  };

  return (
    <motion.div
      className={`canvas-node canvas-node--${node.type}${selected ? " canvas-node--selected" : ""}${node.color ? ` canvas-node--${node.color}` : ""}${isConnectSource ? " canvas-node--connect-source" : ""}${isConnectTarget ? " canvas-node--connect-target" : ""}`}
      style={{ left: node.x, top: node.y, width: node.w, height: node.h, x, y, cursor: mode === "connect" ? "crosshair" : mode === "pan" ? "inherit" : undefined }}
      onPointerDown={onNodePointerDown}
      onDoubleClick={onNodeDoubleClick}
      drag={mode !== "pan" && mode !== "connect"}
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0}
      onDragStart={() => {
        draggingRef.current = true;
        onDragStart(node.id);
      }}
      onDrag={(e, info) => {
        // The node's rendered position is `left/top` (React state,
        // committed every tick below) PLUS this `x`/`y` motion-value
        // transform — framer keeps its OWN running total of pointer
        // offset since drag-start in x/y regardless of what we do with
        // left/top, so committing the delta to `left/top` on every tick
        // WITHOUT also re-zeroing x/y here applies the same movement
        // TWICE (left/top already moved by the delta, then x/y transform
        // ALSO renders that same accumulated offset on top of it) —
        // confirmed live: a precise 100px screen-space drag moved the
        // node ~120px, a consistent ~20% overshoot, not the double-
        // magnitude you'd expect from a naive read of the numbers because
        // framer's own delta calc is itself derived from raw pointer
        // history, not from x/y, so the drift compounds sub-linearly
        // tick over tick rather than as a clean 2x. Resetting x/y to 0
        // immediately after reading THIS tick's delta is safe — framer
        // computes `info.delta` from the pointer's own movement history,
        // not by diffing the current motion-value state, so zeroing them
        // here doesn't corrupt the NEXT tick's delta. This leaves
        // left/top (state) as the single source of truth for position
        // during the whole gesture, which is what makes the node track
        // the cursor exactly instead of drifting.
        onDrag(node.id, info.delta.x / zoom, info.delta.y / zoom);
        x.set(0);
        y.set(0);
      }}
      onDragEnd={() => {
        draggingRef.current = false;
        x.set(0);
        y.set(0);
      }}
      whileDrag={{ zIndex: 20, cursor: "grabbing", scale: 1.03, transition: { duration: 0 } }}
      whileHover={{ scale: 1.015, transition: { duration: 0.12 } }}
      transition={{ duration: 0 }}
    >
      {children}
      {selected && (
        <>
          <button
            type="button"
            className="canvas-node-connector"
            title="Drag to another node to connect"
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartConnect(node.id, e);
            }}
          >
            ●
          </button>
          <div
            className="canvas-node-resize"
            title="Drag to resize"
            onPointerDown={(e) => {
              e.stopPropagation();
              onResizeStart(node.id, e);
            }}
          />
        </>
      )}
    </motion.div>
  );
}

function isHttpUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url.trim());
}

// A real upload (CLAUDE-007) lands as a vault-relative "assets/…" path,
// not a URL the browser can fetch directly — resolveAssetSrc is what
// bridges that: a real https:// link passes through unchanged, an
// "assets/…" path becomes a real, working GET against the new read-back
// route (see assets/read in hermesBridge.js), and anything else (some
// other vault-relative guess the read route can't serve, or empty) comes
// back null so callers fall through to the honest "no preview" state
// instead of trying to load a URL that was never going to work.
function resolveAssetSrc(projectId, url) {
  if (!url) return null;
  if (isHttpUrl(url)) return url;
  if (url.startsWith("assets/")) return assetReadUrl(projectId, url);
  return null;
}

function ImagePreview({ projectId, url }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  const src = resolveAssetSrc(projectId, url);
  if (failed || !src) {
    return <p className="canvas-node-sub canvas-node-ref canvas-node-img-error">couldn't load "{url}" — check the URL/path</p>;
  }
  return (
    <div className="canvas-node-img-wrap">
      <img className="canvas-node-img" src={src} alt="" onError={() => setFailed(true)} draggable={false} />
    </div>
  );
}

function VideoPreview({ projectId, url }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  const src = resolveAssetSrc(projectId, url);
  if (failed || !src) {
    return <p className="canvas-node-sub canvas-node-ref canvas-node-img-error">couldn't load "{url}" — check the URL/path</p>;
  }
  return (
    <div className="canvas-node-img-wrap">
      <video className="canvas-node-video" src={src} controls onError={() => setFailed(true)} onPointerDown={(e) => e.stopPropagation()} />
    </div>
  );
}

function AudioPreview({ projectId, url }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  const src = resolveAssetSrc(projectId, url);
  if (failed || !src) {
    return <p className="canvas-node-sub canvas-node-ref canvas-node-img-error">couldn't load "{url}" — check the URL/path</p>;
  }
  return <audio className="canvas-node-audio" src={src} controls onError={() => setFailed(true)} onPointerDown={(e) => e.stopPropagation()} />;
}

function NodeContent({ node, notes, projectId, onOpenNote, onOpenKanban }) {
  if (node.type === "checklist") {
    const done = node.checklist.filter((c) => c.done).length;
    return (
      <>
        <p className="canvas-node-title">{node.title || "Checklist"}</p>
        <p className="canvas-node-sub mono">
          {done}/{node.checklist.length}
        </p>
        <ul className="canvas-node-checklist">
          {node.checklist.slice(0, 4).map((c) => (
            <li key={c.id} className={c.done ? "canvas-node-checklist-done" : ""}>
              {c.text}
            </li>
          ))}
        </ul>
      </>
    );
  }
  if (node.type === "note") {
    const linked = notes.find((n) => n.id === node.ref?.noteId);
    return (
      <>
        <p className="canvas-node-title">🔗 {node.title || "Note reference"}</p>
        <p className="canvas-node-sub">{linked ? linked.title || "Untitled" : node.ref?.noteId ? "note not found" : "no note selected"}</p>
        {linked && (
          <button type="button" className="canvas-node-open-link" onPointerDown={(e) => e.stopPropagation()} onClick={() => onOpenNote(linked.id)}>
            open note →
          </button>
        )}
      </>
    );
  }
  if (node.type === "kanban") {
    return (
      <>
        <p className="canvas-node-title">▤ {node.title || "Kanban reference"}</p>
        <p className="canvas-node-sub mono">{node.ref?.taskId || "no task id set"}</p>
        {node.ref?.taskId && (
          <button type="button" className="canvas-node-open-link" onPointerDown={(e) => e.stopPropagation()} onClick={onOpenKanban}>
            open Kanban board →
          </button>
        )}
      </>
    );
  }
  if (node.type === "image") {
    const url = node.ref?.url;
    return (
      <>
        <p className="canvas-node-title">🖼 {node.title || "Image"}</p>
        {url ? (
          <ImagePreview projectId={projectId} url={url} />
        ) : (
          <p className="canvas-node-sub canvas-node-ref">no image set</p>
        )}
      </>
    );
  }
  if (node.type === "video") {
    const url = node.ref?.url;
    return (
      <>
        <p className="canvas-node-title">🎬 {node.title || "Video"}</p>
        {url ? (
          <VideoPreview projectId={projectId} url={url} />
        ) : (
          <p className="canvas-node-sub canvas-node-ref">no video set</p>
        )}
      </>
    );
  }
  if (node.type === "audio") {
    const url = node.ref?.url;
    return (
      <>
        <p className="canvas-node-title">🎵 {node.title || "Audio"}</p>
        {url ? (
          <AudioPreview projectId={projectId} url={url} />
        ) : (
          <p className="canvas-node-sub canvas-node-ref">no audio set</p>
        )}
      </>
    );
  }
  if (node.type === "file") {
    const url = node.ref?.url;
    // A real upload's "assets/…" path IS openable now — resolveAssetSrc
    // turns it into a real GET against the read-back route, so this gets
    // a genuine link instead of the old "stored as a reference but can't
    // be opened from here" text (that limitation was real before there
    // was any way to read a vault-relative path back out at all).
    const href = resolveAssetSrc(projectId, url);
    return (
      <>
        <p className="canvas-node-title">📄 {node.title || "File reference"}</p>
        {url ? (
          href ? (
            <a className="canvas-node-sub canvas-node-ref canvas-node-link" href={href} target="_blank" rel="noreferrer" onPointerDown={(e) => e.stopPropagation()}>
              {url} ↗
            </a>
          ) : (
            <p className="canvas-node-sub canvas-node-ref">{url}</p>
          )
        ) : (
          <p className="canvas-node-sub canvas-node-ref">no URL/path set</p>
        )}
      </>
    );
  }
  return (
    <>
      {node.title && <p className="canvas-node-title">{node.title}</p>}
      {node.body && <p className="canvas-node-body">{node.body}</p>}
    </>
  );
}

// Inline title/body editing (CLAUDE-005) — double-click on a text/sticky/
// card/decision/circle node drops straight into this instead of requiring
// a trip to the inspector drawer. Title Enter/Escape and body Escape exit
// edit mode explicitly; clicking away also exits it, via CanvasEditor's own
// effect that clears editingId whenever selection changes away from it —
// so there's no separate "click outside" listener to wire up here.
function NodeInlineEdit({ node, onChange, onDone }) {
  const titleRef = useRef(null);
  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);
  return (
    <div className="canvas-node-edit" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <input
        ref={titleRef}
        className="canvas-node-edit-title"
        value={node.title}
        placeholder="Title…"
        onChange={(e) => onChange({ title: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Escape") {
            e.preventDefault();
            // Without this, Escape still bubbles past this handler up to
            // PageShell's own global (bubble-phase) Escape-to-home listener
            // — confirmed live: typing Escape here navigated all the way
            // to the hero page instead of just closing the edit box, same
            // family of bug as CanvasEditor's own top-level Escape handler
            // (see its comment), just reachable through a different path
            // this time since THIS handler runs directly on the input, not
            // through the capture-phase window listener that fix relies on.
            e.stopPropagation();
            onDone();
          }
        }}
      />
      <textarea
        className="canvas-node-edit-body mono"
        value={node.body}
        placeholder="Text…"
        onChange={(e) => onChange({ body: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onDone();
          }
        }}
      />
    </div>
  );
}

// Reference-an-existing-file flow (CLAUDE-006) — lists what's REALLY sitting
// in this project's assets/ vault folder (filenames only, fetched on demand)
// instead of asking Marco to type a path blind. There's deliberately no
// upload here: this backend has no route that accepts binary bytes, so a
// picker that only ever shows what's already really there is the honest
// version of "import" for this build.
function AssetPicker({ projectId, onPick }) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    setOpen(true);
    if (assets !== null) return;
    try {
      const res = await fetchProjectAssets(projectId);
      setAssets(res.data || []);
      setError(null);
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  return (
    <div className="canvas-asset-picker">
      <button type="button" className="btn-pill" onClick={() => (open ? setOpen(false) : load())}>
        {open ? "hide project assets" : "browse project assets"}
      </button>
      {open && (
        <div className="canvas-asset-picker-list">
          {error && <p className="panel-error">Couldn't list assets: {error}</p>}
          {!error && assets === null && <p className="panel-empty">Loading…</p>}
          {!error && assets && assets.length === 0 && (
            <p className="panel-empty">Nothing in this project's assets/ folder yet — drop a file into it in the vault, then browse again.</p>
          )}
          {assets?.map((asset) => (
            <button key={asset.name} type="button" className="canvas-asset-picker-item mono" onClick={() => onPick(`assets/${asset.name}`)}>
              {asset.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Real upload (CLAUDE-007) — a plain hidden <input type="file">, not a
// drop zone or anything fancier; the file-picker + a visible button is the
// least surprising way to trigger it, and reuses the OS's own picker
// instead of reinventing one. Validates size/extension client-side first
// so a wrong file gets instant feedback instead of a round trip to the
// server just to be told no — the server re-validates the same rules
// regardless, since a client-side check is a convenience, not a security
// boundary.
function AssetUploadButton({ projectId, mediaType, onUploaded, pushToast }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  // "any" (the asset library's upload button, CLAUDE-008) accepts every
  // extension this build recognizes across all media types, since the
  // library isn't scoped to one node's ref field the way a node inspector's
  // upload button is.
  const allowedExts = mediaType === "any" ? ALL_ASSET_EXTENSIONS : ASSET_EXTENSIONS[mediaType] || [];
  const accept = allowedExts.map((e) => `.${e}`).join(",");

  const onFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // otherwise re-picking the SAME file fires no change event next time
    if (!file) return;
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!allowedExts.includes(ext)) {
      pushToast(`Unsupported file type — expected ${allowedExts.join("/")}`, { tone: "error", duration: 4000 });
      return;
    }
    if (file.size > ASSET_MAX_BYTES) {
      pushToast(`File too large — ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds the 25MB limit`, { tone: "error", duration: 4000 });
      return;
    }
    setUploading(true);
    pushToast(`Uploading ${file.name}…`, { duration: 2600 });
    try {
      const res = await uploadProjectAsset(projectId, file);
      onUploaded(res.data);
      pushToast(`Uploaded ${file.name}`, { tone: "ok", duration: 1800 });
    } catch (err) {
      pushToast(`Upload failed — ${err.message || "unknown error"}`, { tone: "error", duration: 5000 });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="canvas-asset-upload">
      <input ref={inputRef} type="file" accept={accept} className="canvas-asset-upload-input" onChange={onFileChosen} tabIndex={-1} />
      <button type="button" className="btn-pill" disabled={uploading} onClick={() => inputRef.current?.click()}>
        {uploading ? "uploading…" : "upload file"}
      </button>
    </div>
  );
}

// Project asset library (CLAUDE-008) — the canvas-wide counterpart to
// AssetPicker/AssetUploadButton above: those are scoped to one selected
// node's ref field, this is a standalone drawer listing everything real
// that's actually sitting in the project's assets/ vault folder, with a
// size/type/thumbnail per card and drag-to-canvas / click-to-insert /
// copy-path actions. Fetches fresh on mount (drawer open) and again after
// every upload, so it never shows a stale list.
function AssetLibraryPanel({ projectId, onClose, onInsert, pushToast }) {
  const [assets, setAssets] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    try {
      const res = await fetchProjectAssets(projectId);
      setAssets(res.data || []);
      setError(null);
    } catch (err) {
      setError(err.message || String(err));
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = (assets || []).filter((a) => {
    if (filter === "all") return true;
    if (filter === "other") return !a.mediaType;
    return a.mediaType === filter;
  });

  const copyPath = async (relPath) => {
    try {
      await navigator.clipboard.writeText(relPath);
      pushToast("Path copied", { duration: 1400 });
    } catch {
      pushToast("Couldn't copy — clipboard unavailable", { tone: "error", duration: 2400 });
    }
  };

  return (
    <aside className="canvas-inspector canvas-asset-library">
      <div className="canvas-inspector-head">
        <p className="canvas-inspector-type mono">Asset library</p>
        <button type="button" className="btn-pill" onClick={onClose}>
          close
        </button>
      </div>

      <div className="canvas-inspector-section">
        <AssetUploadButton projectId={projectId} mediaType="any" pushToast={pushToast} onUploaded={load} />
        <p className="panel-empty canvas-inspector-hint">
          Every real file in this project's <code>assets/</code> vault folder. Drag a card onto the canvas, or click
          one to insert it at the center.
        </p>
      </div>

      <div className="canvas-asset-library-filters" role="tablist" aria-label="Filter assets by type">
        {ASSET_LIBRARY_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            className={`canvas-asset-filter-btn${filter === f.key ? " canvas-asset-filter-btn--active" : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="canvas-asset-library-list">
        {error && <p className="panel-error">Couldn't list assets: {error}</p>}
        {!error && assets === null && <p className="panel-empty">Loading…</p>}
        {!error && assets && assets.length === 0 && (
          <p className="panel-empty">No assets uploaded yet — use "upload file" above to add the first one.</p>
        )}
        {!error && assets && assets.length > 0 && filtered.length === 0 && <p className="panel-empty">Nothing in this filter yet.</p>}
        {filtered.map((asset) => {
          const relPath = `assets/${asset.name}`;
          return (
            <div
              key={asset.name}
              className="canvas-asset-card"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/x-hermes-asset", JSON.stringify(asset));
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => onInsert(asset)}
              title="Drag onto the canvas, or click to insert"
            >
              <div className="canvas-asset-card-thumb">
                {asset.mediaType === "image" ? (
                  <img src={assetReadUrl(projectId, relPath)} alt="" loading="lazy" />
                ) : (
                  <span aria-hidden="true">{assetGlyph(asset.mediaType)}</span>
                )}
              </div>
              <div className="canvas-asset-card-body">
                <p className="canvas-asset-card-name mono">{asset.name}</p>
                <p className="canvas-asset-card-meta mono">
                  {asset.mediaType || "other"} · {formatAssetSize(asset.size)}
                </p>
              </div>
              <button
                type="button"
                className="canvas-asset-card-copy"
                onClick={(e) => {
                  e.stopPropagation();
                  copyPath(relPath);
                }}
                title="Copy vault path"
              >
                copy
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function NodeInspector({ node, notes, projectId, onChange, onDelete, onDuplicate, onClose, pushToast, onOpenNote, onOpenKanban }) {
  return (
    <aside className="canvas-inspector">
      <div className="canvas-inspector-head">
        <p className="canvas-inspector-type mono">{NODE_TYPES.find((t) => t.key === node.type)?.label || node.type}</p>
        <button type="button" className="btn-pill" onClick={onClose}>
          close
        </button>
      </div>

      <div className="canvas-inspector-section">
        <p className="canvas-inspector-section-title">Content</p>
        <label className="job-modal-label mono">
          Title
          <input className="job-modal-input" value={node.title} onChange={(e) => onChange({ title: e.target.value })} />
        </label>
        {node.type !== "checklist" && node.type !== "note" && node.type !== "kanban" && (
          <label className="job-modal-label mono">
            Body
            <textarea className="job-modal-textarea mono" rows={4} value={node.body} onChange={(e) => onChange({ body: e.target.value })} />
          </label>
        )}
        {(node.type === "image" || node.type === "video" || node.type === "audio" || node.type === "file") && (
          <>
            <AssetUploadButton
              projectId={projectId}
              mediaType={node.type}
              pushToast={pushToast}
              onUploaded={(data) => onChange({ ref: { url: data.path, mediaType: data.mediaType, size: data.size } })}
            />
            <label className="job-modal-label mono">
              {node.type === "image" ? "Image URL" : node.type === "video" ? "Video URL" : node.type === "audio" ? "Audio URL" : "File URL / vault path"}
              <input className="job-modal-input" value={node.ref?.url || ""} onChange={(e) => onChange({ ref: { url: e.target.value } })} placeholder="https:// or assets/…" />
            </label>
            <p className="panel-empty canvas-inspector-hint">
              Upload writes a real file into this project's <code>assets/</code> vault folder and previews it right
              here. A public https:// link previews the same way without uploading anything. A vault-relative path
              you type by hand (not uploaded) only resolves if a file with that exact name already exists there.
            </p>
            <AssetPicker projectId={projectId} onPick={(relPath) => onChange({ ref: { url: relPath } })} />
            {node.ref?.url && (
              <div className="canvas-inspector-preview">
                {node.type === "image" && <ImagePreview projectId={projectId} url={node.ref.url} />}
                {node.type === "video" && <VideoPreview projectId={projectId} url={node.ref.url} />}
                {node.type === "audio" && <AudioPreview projectId={projectId} url={node.ref.url} />}
              </div>
            )}
          </>
        )}
        {node.type === "note" && (
          <>
            <label className="job-modal-label mono">
              Linked note
              <select className="notes-meta-select mono" value={node.ref?.noteId || ""} onChange={(e) => onChange({ ref: { noteId: e.target.value || null } })}>
                <option value="">none</option>
                {notes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title || "Untitled"}
                  </option>
                ))}
              </select>
            </label>
            {node.ref?.noteId && notes.some((n) => n.id === node.ref.noteId) ? (
              <button type="button" className="btn-pill" onClick={() => onOpenNote(node.ref.noteId)}>
                open note →
              </button>
            ) : (
              node.ref?.noteId && <p className="panel-error">Note not found — it may have been archived or deleted.</p>
            )}
          </>
        )}
        {node.type === "kanban" && (
          <>
            <label className="job-modal-label mono">
              Kanban task ID
              <input className="job-modal-input mono" value={node.ref?.taskId || ""} onChange={(e) => onChange({ ref: { taskId: e.target.value } })} placeholder="t_xxxxxxxx" />
            </label>
            {node.ref?.taskId && (
              <button type="button" className="btn-pill" onClick={onOpenKanban}>
                open Kanban board →
              </button>
            )}
          </>
        )}
        {node.type === "checklist" && (
          <ChecklistEditor items={node.checklist} onChange={(checklist) => onChange({ checklist })} />
        )}
      </div>

      <div className="canvas-inspector-section">
        <p className="canvas-inspector-section-title">Appearance</p>
        <div className="notes-color-row">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`note-color-swatch note-color-swatch--${c}${node.color === c ? " note-color-swatch--active" : ""}`}
              onClick={() => onChange({ color: c })}
              title={c}
            />
          ))}
        </div>
      </div>

      <div className="canvas-inspector-actions">
        <GlassButton variant="secondary" onClick={onDuplicate}>
          duplicate
        </GlassButton>
        <GlassButton variant="danger" onClick={onDelete}>
          delete node
        </GlassButton>
      </div>
    </aside>
  );
}

function ChecklistEditor({ items, onChange }) {
  const [text, setText] = useState("");
  return (
    <div className="notes-checklist">
      <p className="panel-section-title" style={{ marginBottom: 0 }}>
        Items
      </p>
      {items.map((c) => (
        <div key={c.id} className="notes-checklist-item">
          <label className="notes-checklist-label">
            <input type="checkbox" checked={c.done} onChange={() => onChange(items.map((i) => (i.id === c.id ? { ...i, done: !i.done } : i)))} />
            <span className={c.done ? "notes-checklist-done" : ""}>{c.text}</span>
          </label>
          <button type="button" className="notes-checklist-remove" onClick={() => onChange(items.filter((i) => i.id !== c.id))}>
            ×
          </button>
        </div>
      ))}
      <form
        className="notes-checklist-add"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onChange([...items, { id: uid(), text: text.trim(), done: false }]);
          setText("");
        }}
      >
        <input className="notes-checklist-input mono" value={text} onChange={(e) => setText(e.target.value)} placeholder="+ item…" />
      </form>
    </div>
  );
}

/* Edge lines live in an SVG layer inside .canvas-world, so they share its
   pan/zoom transform for free — endpoints are just raw node x/y/w/h, no
   separate coordinate conversion needed. A wide invisible stroke on top of
   the visible one gives each edge a real click target without fattening
   the line itself. */
function EdgeLayer({ nodes, edges, connecting, onDeleteEdge }) {
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const center = (n) => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 });

  return (
    <svg className="canvas-edge-layer">
      <defs>
        <marker id="canvas-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(110, 231, 223, 0.75)" />
        </marker>
      </defs>
      {edges.map((e) => {
        const from = byId.get(e.from);
        const to = byId.get(e.to);
        if (!from || !to) return null;
        const a = center(from);
        const b = center(to);
        return (
          <g key={e.id}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="canvas-edge-hit" onPointerDown={(ev) => ev.stopPropagation()} onClick={() => onDeleteEdge(e.id)} />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="canvas-edge-line" markerEnd="url(#canvas-arrow)" />
          </g>
        );
      })}
      {connecting && byId.get(connecting.fromId) && (
        <line
          x1={center(byId.get(connecting.fromId)).x}
          y1={center(byId.get(connecting.fromId)).y}
          x2={connecting.x}
          y2={connecting.y}
          className="canvas-edge-line canvas-edge-line--pending"
        />
      )}
    </svg>
  );
}

function CanvasEditor({ projectId, canvas, onBack, onSaved }) {
  const { notes, requestSelectNote } = useNotes();
  const { goTo } = useViewMode();
  // Cross-linking (CLAUDE-004) — a note-ref/kanban-ref node's "open"
  // action. Notes stay a real global object (see NodeContent's own header
  // comment for the note-type branch), so "open" here means the same
  // thing it means everywhere else in this workspace: select it in the
  // real Notes editor and navigate there — not a canvas-local preview.
  // Kanban has no per-task deep view in this build, so "open" goes to the
  // real board where the task genuinely lives; if the id is stale, the
  // board itself is what tells the truth about that, not a guess made here.
  const onOpenNote = (noteId) => {
    requestSelectNote(noteId);
    goTo("notes");
  };
  const onOpenKanban = () => goTo("kanban");
  // Array.isArray, not just `|| []` — the backend already guarantees this
  // shape (see sanitizeCanvasRecord in hermesBridge.js), but a truthy
  // non-array here (an old cached response, a future schema change) would
  // otherwise reach nodes.map/.find below and crash the whole editor
  // instead of just opening as empty.
  const [nodes, setNodes] = useState(Array.isArray(canvas.nodes) ? canvas.nodes : []);
  const [edges, setEdges] = useState(Array.isArray(canvas.edges) ? canvas.edges : []);
  const [selectedId, setSelectedId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [connecting, setConnecting] = useState(null); // { fromId, x, y } in world coords
  const [mode, setMode] = useState("select");
  const [showModeHelp, setShowModeHelp] = useState(false);
  const [editingId, setEditingId] = useState(null);
  // Asset library drawer (CLAUDE-008) shares the same right-hand drawer
  // slot as the node inspector — only one can be open at a time, so
  // selecting a node closes the library and opening the library deselects
  // whatever node was selected. See selectNode/toggleAssetLibrary below.
  const [showAssetLibrary, setShowAssetLibrary] = useState(false);
  const panRef = useRef(null);
  const viewportRef = useRef(null);
  const saveTimer = useRef(null);
  const saveStateTimer = useRef(null);
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();

  const selected = nodes.find((n) => n.id === selectedId) || null;

  // "idle" | "saving" | "saved" | "error" — a persistent, non-spammy
  // status label near the toolbar (CLAUDE-007) instead of a toast per
  // save, since edits (and their debounced saves) can fire far more often
  // than a toast queue should ever show. "saved" reverts to "idle" after
  // a couple seconds; "error" deliberately does NOT auto-clear — it's the
  // one state that must stay visible until the next save actually
  // succeeds, per the "persistence failure" feedback requirement.
  const [saveState, setSaveState] = useState("idle");

  const scheduleSave = useCallback(
    (nextNodes, nextEdges) => {
      clearTimeout(saveTimer.current);
      clearTimeout(saveStateTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaveState("saving");
        try {
          const res = await writeVaultCanvas(projectId, canvas.id, { ...canvas, nodes: nextNodes, edges: nextEdges });
          onSaved(res.data);
          setSaveState("saved");
          saveStateTimer.current = setTimeout(() => setSaveState("idle"), 2000);
        } catch {
          setSaveState("error");
          pushToast("Couldn't save canvas — will retry on next edit", { tone: "error", duration: 5000 });
        }
      }, 600);
    },
    [projectId, canvas, onSaved, pushToast]
  );

  // Undo/redo covers structural actions (add/delete/duplicate node, drag,
  // resize, add/delete edge) via one snapshot per gesture — NOT every
  // keystroke in a title/body edit, which would flood the stack with
  // near-duplicate entries for one word typed. commit() is the only path
  // that both changes state and schedules a save, so nothing can drift
  // out of sync between what's on screen and what's queued to persist.
  const commit = useCallback(
    (nextNodes, nextEdges, { pushHistory = true } = {}) => {
      if (pushHistory) {
        undoStack.current.push({ nodes, edges });
        if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
        redoStack.current = [];
      }
      setNodes(nextNodes);
      setEdges(nextEdges);
      scheduleSave(nextNodes, nextEdges);
    },
    [nodes, edges, scheduleSave]
  );

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push({ nodes, edges });
    setNodes(prev.nodes);
    setEdges(prev.edges);
    scheduleSave(prev.nodes, prev.edges);
    pushToast("Undone", { duration: 1400 });
  }, [nodes, edges, scheduleSave, pushToast]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push({ nodes, edges });
    setNodes(next.nodes);
    setEdges(next.edges);
    scheduleSave(next.nodes, next.edges);
    pushToast("Redone", { duration: 1400 });
  }, [nodes, edges, scheduleSave, pushToast]);

  // Inspector field edits AND inline node editing (title/body/ref/color/
  // checklist) intentionally don't push undo history — undo covers
  // structural actions (add/delete/duplicate node, drag, resize, connect),
  // not every keystroke, or typing one word into a title would bury the
  // drag you actually want to undo under dozens of one-character text-edit
  // steps.
  const updateNode = (id, patch) => {
    commit(
      nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
      edges,
      { pushHistory: false }
    );
  };
  const updateSelectedNode = (patch) => updateNode(selectedId, patch);

  // Inline editing only ever applies to the currently selected node (see
  // NodeShell's onNodeDoubleClick, which selects before it starts editing)
  // — so the moment selection moves elsewhere (another node, background
  // click, Escape, delete), editing state should go with it rather than
  // silently keeping some OTHER node's edit box open off-screen.
  useEffect(() => {
    if (editingId && editingId !== selectedId) setEditingId(null);
  }, [selectedId, editingId]);

  // Selection and the asset library drawer share one right-hand drawer slot
  // (CLAUDE-008) — routing every "select a node" path through this instead
  // of the raw setSelectedId setter keeps that exclusive: picking a node
  // always closes the library rather than leaving it stacked behind the
  // inspector. Deselecting (id === null) leaves the library's own state
  // alone, since that path never opens it.
  const selectNode = (id) => {
    setSelectedId(id);
    if (id) setShowAssetLibrary(false);
  };

  const toggleAssetLibrary = () => {
    setShowAssetLibrary((s) => {
      const next = !s;
      if (next) setSelectedId(null);
      return next;
    });
  };

  const addNode = (type) => {
    const centerX = (240 - pan.x) / zoom;
    const centerY = (200 - pan.y) / zoom;
    const node = newNode(type, snap(centerX, snapEnabled), snap(centerY, snapEnabled));
    commit([...nodes, node], edges);
    selectNode(node.id);
    pushToast(`${NODE_TYPES.find((t) => t.key === type)?.label || "Node"} added`, { duration: 1600 });
  };

  // Text/Shape modes place the new node exactly where the user clicked
  // (world coords via clientToWorld, defined below) instead of the
  // toolbar's fixed near-center spot — the whole point of a placement
  // mode is that you pick the spot. `patch` lets a caller (drag-and-drop —
  // see onCanvasDrop) seed the new node's content in the same commit,
  // instead of creating it empty and immediately editing it.
  const addNodeAt = (type, clientX, clientY, patch = {}) => {
    const p = clientToWorld(clientX, clientY);
    const node = { ...newNode(type, snap(p.x - 110, snapEnabled), snap(p.y - 40, snapEnabled)), ...patch };
    commit([...nodes, node], edges);
    selectNode(node.id);
    pushToast(`${NODE_TYPES.find((t) => t.key === type)?.label || "Node"} added`, { duration: 1600 });
    return node;
  };

  // Click-to-insert from the asset library (CLAUDE-008) — same shape as
  // addNode's toolbar placement (fixed near-center spot, not a click
  // position, since a library card click carries no canvas coordinate),
  // just pre-filled with the asset's ref instead of an empty one.
  const insertAssetNode = (asset) => {
    const centerX = (240 - pan.x) / zoom;
    const centerY = (200 - pan.y) / zoom;
    const type = mediaTypeToNodeType(asset.mediaType);
    const node = {
      ...newNode(type, snap(centerX, snapEnabled), snap(centerY, snapEnabled)),
      title: asset.name,
      ref: { url: `assets/${asset.name}`, mediaType: asset.mediaType, size: asset.size },
    };
    commit([...nodes, node], edges);
    selectNode(node.id);
    pushToast(`${asset.name} added to canvas`, { duration: 1600 });
  };

  const duplicateNode = () => {
    if (!selected) return;
    const copy = { ...selected, id: uid(), x: selected.x + 24, y: selected.y + 24, checklist: selected.checklist.map((c) => ({ ...c })) };
    commit([...nodes, copy], edges);
    selectNode(copy.id);
    pushToast("Node duplicated", { duration: 1600 });
  };

  const deleteNode = () => {
    if (!selected) return;
    commit(
      nodes.filter((n) => n.id !== selected.id),
      edges.filter((e) => e.from !== selected.id && e.to !== selected.id)
    );
    setSelectedId(null);
    pushToast("Node deleted", { duration: 1600 });
  };

  const deleteEdge = (edgeId) => {
    commit(nodes, edges.filter((e) => e.id !== edgeId));
    pushToast("Connection removed", { duration: 1600 });
  };

  // One consolidated keyboard handler for the whole editor: undo/redo (was
  // already here), mode shortcuts (V/H/C/T/R), hold-Space-to-pan, Delete/
  // Backspace to remove the selected node, and Escape. Escape is the
  // tricky one — PageShell has its OWN global Escape listener that
  // navigates all the way home, attached the moment PageShell itself
  // mounts (long before this editor exists — PageShell is a persistent
  // ancestor, CanvasEditor mounts/unmounts under it as Marco navigates).
  // Registration order between two listeners on the same target (window)
  // is what decides who runs first, and PageShell's was always going to
  // be first that way — child-before-parent effect order only applies to
  // effects that mount in the SAME commit, not to a listener attached by
  // an ancestor that already existed. stopImmediatePropagation() from
  // here arrived too late for that reason (confirmed live: Escape
  // navigated home instead of deselecting). The fix that's actually
  // order-independent: attach this one with {capture:true}. Capture-phase
  // listeners on a target always run before bubble-phase listeners on
  // that same target, regardless of which was registered first — so this
  // reliably wins over PageShell's plain (bubble-phase) listener. With
  // nothing to back out of, this handler does nothing and PageShell's own
  // listener still runs normally ("go home"), same as any other page.
  const modeBeforeSpaceRef = useRef(null);
  useEffect(() => {
    const isTyping = () => {
      const tag = document.activeElement?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA";
    };
    const onKeyDown = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        if (isTyping()) return;
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (isTyping()) return;
      if (e.key === "Escape") {
        if (mode !== "select" || selectedId || showAssetLibrary) {
          e.preventDefault();
          e.stopPropagation();
          setMode("select");
          setSelectedId(null);
          setShowAssetLibrary(false);
        }
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        deleteNode();
        return;
      }
      if (e.code === "Space" && !e.repeat && mode !== "pan") {
        e.preventDefault();
        modeBeforeSpaceRef.current = mode;
        setMode("pan");
        return;
      }
      if (mod) return;
      const found = MODES.find((m) => m.shortcut.toLowerCase() === e.key.toLowerCase());
      if (found) {
        e.preventDefault();
        setMode(found.key);
      }
    };
    const onKeyUp = (e) => {
      if (e.code === "Space" && modeBeforeSpaceRef.current) {
        setMode(modeBeforeSpaceRef.current);
        modeBeforeSpaceRef.current = null;
      }
    };
    // capture:true — see the comment above; this must win the race against
    // PageShell's bubble-phase Escape listener regardless of mount order.
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [undo, redo, mode, selectedId, showAssetLibrary, deleteNode]);

  // One undo snapshot per drag gesture (dragStart), not per tick — see
  // commit()'s header comment. Ticks after the first call commit with
  // pushHistory:false so a whole drag collapses into a single undo step.
  const dragStartedRef = useRef(false);
  const onDragNodeStart = () => {
    dragStartedRef.current = true;
  };
  const onDragNode = (id, dx, dy) => {
    const pushHistory = dragStartedRef.current;
    dragStartedRef.current = false;
    const next = nodes.map((n) => (n.id === id ? { ...n, x: snap(n.x + dx, snapEnabled), y: snap(n.y + dy, snapEnabled) } : n));
    commit(next, edges, { pushHistory });
  };

  const resizingRef = useRef(null);
  const onResizeStart = (id, e) => {
    resizingRef.current = { id, startX: e.clientX, startY: e.clientY, first: true };
    // Captured once at gesture start (same reasoning as startW/startH
    // below): every tick recomputes w/h from this same base array rather
    // than the previous tick's result, so there's no need for React's
    // updater-function form here — and no nested setState-inside-setState.
    const baseNodes = nodes;
    const node = baseNodes.find((n) => n.id === id);
    const startW = node.w;
    const startH = node.h;
    const onMove = (ev) => {
      const r = resizingRef.current;
      if (!r) return;
      const dx = (ev.clientX - r.startX) / zoom;
      const dy = (ev.clientY - r.startY) / zoom;
      const nextW = snap(Math.max(MIN_W, startW + dx), snapEnabled);
      const nextH = snap(Math.max(MIN_H, startH + dy), snapEnabled);
      const pushHistory = r.first;
      resizingRef.current = { ...r, first: false };
      const next = baseNodes.map((n) => (n.id === id ? { ...n, w: nextW, h: nextH } : n));
      commit(next, edges, { pushHistory });
    };
    const onUp = () => {
      resizingRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const clientToWorld = (clientX, clientY) => {
    const rect = viewportRef.current.getBoundingClientRect();
    return { x: (clientX - rect.left - pan.x) / zoom, y: (clientY - rect.top - pan.y) / zoom };
  };

  const onStartConnect = (fromId, e) => {
    const start = clientToWorld(e.clientX, e.clientY);
    setConnecting({ fromId, x: start.x, y: start.y });
    const onMove = (ev) => {
      const p = clientToWorld(ev.clientX, ev.clientY);
      setConnecting((c) => (c ? { ...c, x: p.x, y: p.y } : c));
    };
    const onUp = (ev) => {
      const p = clientToWorld(ev.clientX, ev.clientY);
      // Excludes the source node from the search itself (not just checked
      // after) — matters when nodes overlap or sit close together: without
      // this, .find() could match the SOURCE node first (its own bounds
      // also satisfy the hit-test at a point that's also over a different,
      // intended target) and stop there, silently landing on "cancelled"
      // even though the live hover highlight had correctly shown the OTHER
      // node as connectable at that exact spot (confirmed live: this
      // mismatch was real, not hypothetical — this is the same padded
      // hit-test the live highlight uses, and it needs the exact same
      // exclusion to ever agree with what was highlighted).
      const target = nodes.find((n) => n.id !== fromId && nodeContainsPoint(n, p.x, p.y, CONNECT_HIT_PADDING));
      setConnecting(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (target) {
        const exists = edges.some((e) => (e.from === fromId && e.to === target.id) || (e.from === target.id && e.to === fromId));
        if (exists) {
          pushToast("Already connected", { duration: 1600 });
        } else {
          commit(nodes, [...edges, { id: uid(), from: fromId, to: target.id }]);
          pushToast("Nodes connected", { duration: 1600 });
        }
      } else {
        // Dropped on empty canvas or back on the source node itself —
        // not an error, just a cancelled gesture, so this stays quiet and
        // brief rather than reading as a failure.
        pushToast("Connection cancelled", { duration: 1200 });
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // In Select mode this only fires for a TRUE empty-canvas click (target
  // is exactly the world div — a click that started on a node never
  // reaches here as an empty click, since NodeShell's own pointerdown
  // handles it, but the event still bubbles here too, hence the target
  // check). Pan mode relaxes that check entirely — see NodeShell's
  // onNodePointerDown, which deliberately does nothing (no select, no
  // drag) and lets its own pointerdown bubble up here instead.
  const onBackgroundPointerDown = (e) => {
    const isEmptyClick = e.target === panRef.current;
    if (mode === "pan") {
      // fall through to pan below regardless of what was under the pointer
    } else if (mode === "text" || mode === "shape") {
      if (!isEmptyClick) return; // clicking an existing node already selected it in NodeShell
      addNodeAt(mode === "text" ? "text" : "card", e.clientX, e.clientY);
      return;
    } else {
      if (!isEmptyClick) return;
      setSelectedId(null);
    }
    const start = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    const onMove = (ev) => setPan({ x: start.panX + (ev.clientX - start.x), y: start.panY + (ev.clientY - start.y) });
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onWheel = (e) => {
    e.preventDefault();
    setZoom((z) => Math.min(2, Math.max(0.4, z - e.deltaY * 0.001)));
  };

  // Drag-and-drop (CLAUDE-006, extended CLAUDE-007/008 once real upload
  // existed) — three sources land here, checked in order:
  //   1. A card dragged out of the asset library panel (identified by the
  //      internal "application/x-hermes-asset" MIME, set in
  //      AssetLibraryPanel's onDragStart) — already-uploaded, just needs a
  //      node at the drop point.
  //   2. A real OS file (Explorer/Finder — dataTransfer.files is non-empty).
  //      This now genuinely uploads through the same route the library's
  //      upload button uses, rather than the old "can't import" message,
  //      which stopped being true the moment CLAUDE-007 added a real
  //      upload endpoint — leaving it would have been exactly the kind of
  //      dishonest UX this whole pass exists to remove.
  //   3. Plain text/a URL — unchanged from CLAUDE-006.
  const [dropNotice, setDropNotice] = useState(null);
  useEffect(() => {
    if (!dropNotice) return;
    const t = setTimeout(() => setDropNotice(null), 5000);
    return () => clearTimeout(t);
  }, [dropNotice]);

  const onCanvasDragOver = (e) => {
    e.preventDefault();
  };

  const onCanvasDrop = async (e) => {
    e.preventDefault();
    const assetPayload = e.dataTransfer.getData("application/x-hermes-asset");
    if (assetPayload) {
      try {
        const asset = JSON.parse(assetPayload);
        addNodeAt(mediaTypeToNodeType(asset.mediaType), e.clientX, e.clientY, {
          title: asset.name,
          ref: { url: `assets/${asset.name}`, mediaType: asset.mediaType, size: asset.size },
        });
      } catch {
        /* malformed internal payload — silently ignore rather than crash the drop */
      }
      return;
    }
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      if (!ALL_ASSET_EXTENSIONS.includes(ext)) {
        setDropNotice(`Can't add "${file.name}" — unsupported file type. Accepted: ${ALL_ASSET_EXTENSIONS.join("/")}.`);
        return;
      }
      if (file.size > ASSET_MAX_BYTES) {
        setDropNotice(`"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)}MB, over the 25MB upload limit.`);
        return;
      }
      const dropX = e.clientX;
      const dropY = e.clientY;
      setDropNotice(`Uploading ${file.name}…`);
      try {
        const res = await uploadProjectAsset(projectId, file);
        addNodeAt(mediaTypeToNodeType(res.data.mediaType), dropX, dropY, {
          title: file.name,
          ref: { url: res.data.path, mediaType: res.data.mediaType, size: res.data.size },
        });
        setDropNotice(null);
        pushToast(`Uploaded ${file.name}`, { tone: "ok", duration: 1800 });
      } catch (err) {
        setDropNotice(`Upload failed — ${err.message || "unknown error"}`);
      }
      return;
    }
    const text = (e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain") || "").trim();
    if (!text) return;
    if (isHttpUrl(text)) {
      addNodeAt("image", e.clientX, e.clientY, { title: "Image reference", ref: { url: text } });
    } else {
      addNodeAt("text", e.clientX, e.clientY, { body: text });
    }
  };

  // Live "valid target" highlight while dragging a connection (CLAUDE-006)
  // — derived straight from `connecting`'s own live x/y on every render
  // rather than tracked as separate state, so it can never drift out of
  // sync with the exact same padded hit-test onStartConnect's onUp uses to
  // decide what actually connects on release.
  const connectHoverTargetId = connecting
    ? nodes.find((n) => n.id !== connecting.fromId && nodeContainsPoint(n, connecting.x, connecting.y, CONNECT_HIT_PADDING))?.id ?? null
    : null;

  // HUD zoom controls (CLAUDE-004) — the wheel already zooms, but "no tiny
  // raw text controls" means the zoom% readout needs real +/-/reset buttons
  // next to it, not just a passive label.
  const zoomIn = () => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)));
  const zoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="project-canvas-editor">
      <div className="project-section-head">
        <button type="button" className="btn-pill" onClick={onBack}>
          ← canvases
        </button>
        <p className="panel-section-title" style={{ marginBottom: 0 }}>
          {canvas.name}
        </p>
        {saveState !== "idle" && (
          <span className={`canvas-save-state canvas-save-state--${saveState} mono`} role="status">
            {saveState === "saving" && "saving…"}
            {saveState === "saved" && "saved"}
            {saveState === "error" && "save failed"}
          </span>
        )}
        <GlassToolbar className="canvas-history-toolbar">
          <GlassButton variant="secondary" size="sm" onClick={undo} disabled={undoStack.current.length === 0} title="Undo (Ctrl/Cmd+Z)">
            ↶ undo
          </GlassButton>
          <GlassButton variant="secondary" size="sm" onClick={redo} disabled={redoStack.current.length === 0} title="Redo (Ctrl/Cmd+Shift+Z)">
            ↷ redo
          </GlassButton>
          <GlassButton
            variant={snapEnabled ? "primary" : "secondary"}
            size="sm"
            onClick={() => {
              // pushToast is a side effect — it must NOT live inside the
              // setSnapEnabled updater function itself. React (in
              // StrictMode/dev) invokes updater functions twice to verify
              // they're pure, which double-fired the toast here until this
              // was pulled out into a plain click-handler statement using
              // the outer-scope `snapEnabled` (still correct: this closure
              // captures the value from BEFORE the toggle, so `!snapEnabled`
              // is exactly the new state).
              setSnapEnabled((s) => !s);
              pushToast(!snapEnabled ? "Snap to grid on" : "Snap to grid off", { duration: 1400 });
            }}
            title="Snap to grid"
          >
            # snap
          </GlassButton>
          <GlassButton variant={showAssetLibrary ? "primary" : "secondary"} size="sm" onClick={toggleAssetLibrary} title="Project asset library">
            🖼 assets
          </GlassButton>
        </GlassToolbar>
      </div>

      <div className="canvas-mode-bar-row">
        <div className="canvas-mode-bar" role="radiogroup" aria-label="Canvas interaction mode">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={mode === m.key}
              className={`canvas-mode-btn${mode === m.key ? " canvas-mode-btn--active" : ""}`}
              onClick={() => setMode(m.key)}
              title={`${m.hint} (${m.shortcut})`}
            >
              {m.label}
              <span className="canvas-mode-btn-key mono">{m.shortcut}</span>
            </button>
          ))}
        </div>
        <div className="canvas-mode-help-wrap">
          <button
            type="button"
            className={`canvas-mode-help-btn${showModeHelp ? " canvas-mode-help-btn--active" : ""}`}
            onClick={() => setShowModeHelp((s) => !s)}
            title="Mode help"
            aria-expanded={showModeHelp}
          >
            ?
          </button>
          {showModeHelp && (
            <div className="canvas-mode-help-popover">
              <p className="canvas-inspector-section-title">Modes</p>
              <dl className="canvas-mode-help-list">
                {MODES.map((m) => (
                  <div key={m.key} className="canvas-mode-help-row">
                    <dt>
                      {m.label} <span className="canvas-mode-btn-key mono">{m.shortcut}</span>
                    </dt>
                    <dd>{m.hint}</dd>
                  </div>
                ))}
              </dl>
              <p className="canvas-inspector-section-title canvas-mode-help-section-title--second">Other shortcuts</p>
              <dl className="canvas-mode-help-list">
                {OTHER_SHORTCUTS.map((s) => (
                  <div key={s.label} className="canvas-mode-help-row">
                    <dt>
                      {s.label} <span className="canvas-mode-btn-key mono">{s.shortcut}</span>
                    </dt>
                    <dd>{s.hint}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>

      <GlassToolbar className="canvas-toolbar">
        {NODE_GROUPS.map((group, gi) => (
          <div className="canvas-toolbar-group" key={group.label}>
            {gi > 0 && <span className="canvas-toolbar-divider" aria-hidden="true" />}
            {group.keys.map((key) => {
              const t = NODE_TYPES.find((n) => n.key === key);
              return (
                <button key={t.key} type="button" className="canvas-toolbar-btn" onClick={() => addNode(t.key)} title={`Add ${t.label}`}>
                  <span>{t.glyph}</span>
                  {t.label}
                </button>
              );
            })}
          </div>
        ))}
      </GlassToolbar>

      <div className="project-canvas-body">
        <div
          ref={viewportRef}
          className={`canvas-viewport canvas-viewport--mode-${mode}`}
          onPointerDown={onBackgroundPointerDown}
          onWheel={onWheel}
          onDragOver={onCanvasDragOver}
          onDrop={onCanvasDrop}
        >
          <div ref={panRef} className={`canvas-world${snapEnabled ? " canvas-world--grid" : ""}`} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
            <EdgeLayer nodes={nodes} edges={edges} connecting={connecting} onDeleteEdge={deleteEdge} />
            {nodes.map((n) => {
              const canInlineEdit = INLINE_EDIT_TYPES.includes(n.type);
              const isEditing = canInlineEdit && n.id === editingId;
              return (
                <NodeShell
                  key={n.id}
                  node={n}
                  zoom={zoom}
                  mode={mode}
                  selected={n.id === selectedId}
                  isConnectSource={connecting?.fromId === n.id}
                  isConnectTarget={n.id === connectHoverTargetId}
                  onSelect={selectNode}
                  onDragStart={onDragNodeStart}
                  onDrag={onDragNode}
                  onStartConnect={onStartConnect}
                  onResizeStart={onResizeStart}
                  onStartEdit={canInlineEdit ? setEditingId : undefined}
                >
                  <div className={`canvas-node-inner${isEditing ? " canvas-node-inner--editing" : ""}`}>
                    {isEditing ? (
                      <NodeInlineEdit node={n} onChange={(patch) => updateNode(n.id, patch)} onDone={() => setEditingId(null)} />
                    ) : (
                      <NodeContent node={n} notes={notes} projectId={projectId} onOpenNote={onOpenNote} onOpenKanban={onOpenKanban} />
                    )}
                  </div>
                </NodeShell>
              );
            })}
          </div>

          {nodes.length === 0 && (
            <div className="canvas-empty-state">
              <div className="canvas-empty-card">
                <p className="canvas-empty-card-title">This canvas is empty</p>
                <p className="canvas-empty-card-body">
                  Add a node, then drag from a selected node's dot to connect it to another. Switch modes (below the
                  toolbar) to pan, connect, or place nodes exactly where you click.
                </p>
                <div className="canvas-empty-card-actions">
                  <GlassButton variant="secondary" onClick={() => addNode("text")}>
                    + Text
                  </GlassButton>
                  <GlassButton variant="secondary" onClick={() => addNode("card")}>
                    + Shape
                  </GlassButton>
                  <GlassButton variant="secondary" onClick={() => addNode("image")}>
                    + Reference asset
                  </GlassButton>
                  <GlassButton variant="secondary" onClick={() => setShowModeHelp(true)}>
                    Mode help
                  </GlassButton>
                </div>
              </div>
            </div>
          )}

          {dropNotice && (
            <div className="canvas-drop-notice" role="status">
              <span>{dropNotice}</span>
              <button type="button" className="canvas-drop-notice-close" onClick={() => setDropNotice(null)} aria-label="Dismiss">
                ×
              </button>
            </div>
          )}

          <div className="canvas-hud">
            <button type="button" className="canvas-hud-btn" onClick={zoomOut} disabled={zoom <= 0.4} title="Zoom out">
              –
            </button>
            <span className="canvas-hud-zoom mono">{Math.round(zoom * 100)}%</span>
            <button type="button" className="canvas-hud-btn" onClick={zoomIn} disabled={zoom >= 2} title="Zoom in">
              +
            </button>
            <button type="button" className="canvas-hud-btn canvas-hud-reset" onClick={zoomReset} title="Reset view">
              ⤾
            </button>
          </div>

          <ToastStack toasts={toasts} onDismiss={dismissToast} className="canvas-toast-stack" />

          {/* Floats ON TOP of the viewport instead of sharing a grid column
              with it — the board's own box size never changes whether or
              not this is open, so selecting a node can't yank the canvas
              sideways out from under a drag gesture the way the old
              always-reserved column did (see git history). Absolute inside
              .canvas-viewport specifically, not project-canvas-body, so it
              never overlaps the toolbar above it. */}
          <AnimatePresence>
            {(selected || showAssetLibrary) && (
              <motion.div
                key={selected ? selected.id : "asset-library"}
                className="canvas-inspector-drawer"
                initial={{ x: 24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 24, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 36 }}
              >
                {selected ? (
                  <NodeInspector
                    node={selected}
                    notes={notes}
                    projectId={projectId}
                    onChange={updateSelectedNode}
                    onDelete={deleteNode}
                    onDuplicate={duplicateNode}
                    onClose={() => setSelectedId(null)}
                    pushToast={pushToast}
                    onOpenNote={onOpenNote}
                    onOpenKanban={onOpenKanban}
                  />
                ) : (
                  <AssetLibraryPanel projectId={projectId} onClose={() => setShowAssetLibrary(false)} onInsert={insertAssetNode} pushToast={pushToast} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/*
  ProjectCanvas — a custom whiteboard, not Obsidian desktop `.canvas`
  (Marco doesn't work in Obsidian desktop). Each canvas is a JSON file
  under the project's canvases/ subfolder; node drag/resize/connect and
  content edits save debounced (600ms) so it feels alive without
  hammering the vault on every pixel of movement. `edges` is now real,
  UI-created data (V2) — connect two nodes by dragging from a selected
  node's connector dot onto another node.
*/
export function ProjectCanvas({ project, tagFilter, initialOpenId, onConsumeInitialOpen }) {
  const [canvases, setCanvases] = useState(null);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [newName, setNewName] = useState("");
  const [newTags, setNewTags] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetchVaultCanvases(project.id);
      setCanvases(res.data || []);
      setError(null);
    } catch (err) {
      setError(err.message || String(err));
    }
  }, [project.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Cross-linking (CLAUDE-004) — a note's "+ canvas" or a workflow step's
  // "open canvas" jumps here with a specific target id (see ProjectWorkspace's
  // pendingCanvasId). Only fires once canvases have actually loaded, so it
  // can find the target; consumes itself via onConsumeInitialOpen so
  // navigating back to the canvas list and picking a different one later
  // doesn't keep re-triggering this same jump.
  useEffect(() => {
    if (initialOpenId && canvases) {
      setOpenId(initialOpenId);
      onConsumeInitialOpen?.();
    }
  }, [initialOpenId, canvases, onConsumeInitialOpen]);

  const openCanvas = canvases?.find((c) => c.id === openId) || null;
  const visibleCanvases = tagFilter ? canvases?.filter((c) => (c.tags || []).includes(tagFilter)) : canvases;

  const onCreate = async () => {
    if (!newName.trim()) return;
    try {
      const tags = parseTagsInput(newTags);
      const res = await writeVaultCanvas(project.id, null, { name: newName.trim(), tags, nodes: [], edges: [] });
      setNewName("");
      setNewTags("");
      await load();
      setOpenId(res.data.id);
      logProjectActivity(project.id, "canvas", `Canvas created "${newName.trim()}"`);
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  const onArchive = async (id) => {
    try {
      await archiveVaultCanvas(project.id, id);
      await load();
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  if (openCanvas) {
    return (
      <CanvasEditor
        projectId={project.id}
        canvas={openCanvas}
        onBack={() => {
          setOpenId(null);
          load();
        }}
        onSaved={(data) => setCanvases((prev) => prev.map((c) => (c.id === data.id ? data : c)))}
      />
    );
  }

  return (
    <div className="panel-section">
      <div className="project-section-head">
        <p className="panel-section-title" style={{ marginBottom: 0 }}>
          Canvases {canvases && <span className="mono">({visibleCanvases.length}{tagFilter ? ` of ${canvases.length}` : ""})</span>}
        </p>
        <input className="job-modal-input canvas-new-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New canvas name…" onKeyDown={(e) => e.key === "Enter" && onCreate()} />
        <input className="job-modal-input canvas-new-input" value={newTags} onChange={(e) => setNewTags(e.target.value)} placeholder="tags, comma, separated" onKeyDown={(e) => e.key === "Enter" && onCreate()} />
        <button type="button" className="btn-pill" onClick={onCreate}>
          + create
        </button>
      </div>
      {error && <p className="panel-error">{error}</p>}
      {!canvases && !error && <p className="panel-empty">Loading…</p>}
      {canvases && visibleCanvases.length === 0 && (
        <p className="panel-empty">{tagFilter ? `No canvases tagged #${tagFilter}.` : "No canvases yet — create one above."}</p>
      )}
      <div className="canvas-list">
        {visibleCanvases?.map((c) => (
          <div key={c.id} className="canvas-list-item">
            <button type="button" className="canvas-list-open" onClick={() => setOpenId(c.id)}>
              <span className="canvas-list-name">
                {c.name} {(c.tags || []).map((t) => <span key={t} className="tag-badge">#{t}</span>)}
              </span>
              <span className="mono canvas-list-meta">
                {c.error ? <span className="canvas-list-error">⚠ {c.error} — opens as empty</span> : `${c.nodes?.length || 0} nodes · ${c.edges?.length || 0} edges`}
              </span>
            </button>
            <button type="button" className="btn-pill" onClick={() => onArchive(c.id)}>
              archive
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
