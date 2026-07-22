import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useDragControls } from "framer-motion";
import { useNotes } from "../../../state/Notes.jsx";
import { fetchVaultCanvases, writeVaultCanvas, archiveVaultCanvas } from "../../../lib/obsidianBridge.js";
import { parseTagsInput } from "../../../lib/tags.js";
import { GlassButton } from "../../ui/GlassButton.jsx";
import { GlassToolbar } from "../../ui/GlassToolbar.jsx";
import "./ProjectCanvas.css";

const NODE_TYPES = [
  { key: "text", label: "Text", glyph: "T" },
  { key: "sticky", label: "Sticky note", glyph: "◇" },
  { key: "card", label: "Card", glyph: "▭" },
  { key: "decision", label: "Decision", glyph: "◆" },
  { key: "circle", label: "Circle", glyph: "●" },
  { key: "checklist", label: "Checklist", glyph: "☑" },
  { key: "image", label: "Image ref", glyph: "🖼" },
  { key: "file", label: "File ref", glyph: "📄" },
  { key: "note", label: "Note ref", glyph: "🔗" },
  { key: "kanban", label: "Kanban ref", glyph: "▤" },
];

const COLORS = ["teal", "warn", "bad", "ok", "violet"];
const GRID = 20;
const MIN_W = 100;
const MIN_H = 70;
const MAX_HISTORY = 50;

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function newNode(type, x, y) {
  const bigger = type === "circle" || type === "decision";
  return { id: uid(), type, x, y, w: type === "decision" ? 240 : 220, h: bigger ? 160 : 130, title: "", body: "", color: "teal", tags: [], checklist: [], ref: null };
}

function snap(value, enabled) {
  return enabled ? Math.round(value / GRID) * GRID : value;
}

function NodeShell({ node, zoom, selected, onSelect, onDrag, onDragStart, onStartConnect, onResizeStart, children }) {
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

  return (
    <motion.div
      className={`canvas-node canvas-node--${node.type}${selected ? " canvas-node--selected" : ""}${node.color ? ` canvas-node--${node.color}` : ""}`}
      style={{ left: node.x, top: node.y, width: node.w, height: node.h, x, y }}
      onPointerDown={(e) => {
        onSelect(node.id);
        dragControls.start(e);
      }}
      drag
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0}
      onDragStart={() => {
        draggingRef.current = true;
        onDragStart(node.id);
      }}
      onDrag={(e, info) => onDrag(node.id, info.delta.x / zoom, info.delta.y / zoom)}
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

// There's no upload endpoint on this backend (a real one would need a new
// server route to write binary files into the vault over the SSH bridge) —
// so this stays a URL/path field, not a fake "upload" button. What it was
// actually missing was ANY feedback on whether what you typed resolves to
// something real: a live thumbnail (or a clear "couldn't load" state) so
// you're not just guessing whether a path is right.
function ImagePreview({ url }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  if (failed) {
    return <p className="canvas-node-sub canvas-node-ref canvas-node-img-error">couldn't load "{url}" — check the URL/path</p>;
  }
  return (
    <div className="canvas-node-img-wrap">
      <img className="canvas-node-img" src={url} alt="" onError={() => setFailed(true)} draggable={false} />
    </div>
  );
}

function NodeContent({ node, notes }) {
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
      </>
    );
  }
  if (node.type === "kanban") {
    return (
      <>
        <p className="canvas-node-title">▤ {node.title || "Kanban reference"}</p>
        <p className="canvas-node-sub mono">{node.ref?.taskId || "no task id set"}</p>
      </>
    );
  }
  if (node.type === "image") {
    const url = node.ref?.url;
    return (
      <>
        <p className="canvas-node-title">🖼 {node.title || "Image reference"}</p>
        {url ? (
          <ImagePreview url={url} />
        ) : (
          <p className="canvas-node-sub canvas-node-ref">no URL/path set</p>
        )}
      </>
    );
  }
  if (node.type === "file") {
    const url = node.ref?.url;
    const isLink = isHttpUrl(url);
    return (
      <>
        <p className="canvas-node-title">📄 {node.title || "File reference"}</p>
        {url ? (
          isLink ? (
            <a className="canvas-node-sub canvas-node-ref canvas-node-link" href={url} target="_blank" rel="noreferrer" onPointerDown={(e) => e.stopPropagation()}>
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

function NodeInspector({ node, notes, onChange, onDelete, onDuplicate, onClose }) {
  return (
    <aside className="canvas-inspector">
      <div className="project-section-head">
        <p className="panel-section-title" style={{ marginBottom: 0 }}>
          {NODE_TYPES.find((t) => t.key === node.type)?.label || node.type}
        </p>
        <button type="button" className="btn-pill" onClick={onClose}>
          close
        </button>
      </div>
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
      {(node.type === "image" || node.type === "file") && (
        <>
          <label className="job-modal-label mono">
            {node.type === "image" ? "Image URL" : "File URL / vault path"}
            <input className="job-modal-input" value={node.ref?.url || ""} onChange={(e) => onChange({ ref: { url: e.target.value } })} placeholder="https://…" />
          </label>
          <p className="panel-empty canvas-inspector-hint">
            {node.type === "image"
              ? "A public image URL — pasted, it previews live below. There's no upload on this build; a vault-relative path won't render here (the browser can't reach it), only a real https:// link will."
              : "A link (https://…) opens in a new tab from the node. A vault-relative path (e.g. Hermes/Projects/…/assets/file.pdf) is stored as a reference but can't be opened from here — there's no upload/open-from-vault on this build."}
          </p>
          {node.type === "image" && node.ref?.url && (
            <div className="canvas-inspector-preview">
              <ImagePreview url={node.ref.url} />
            </div>
          )}
        </>
      )}
      {node.type === "note" && (
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
      )}
      {node.type === "kanban" && (
        <label className="job-modal-label mono">
          Kanban task ID
          <input className="job-modal-input mono" value={node.ref?.taskId || ""} onChange={(e) => onChange({ ref: { taskId: e.target.value } })} placeholder="t_xxxxxxxx" />
        </label>
      )}
      {node.type === "checklist" && (
        <ChecklistEditor items={node.checklist} onChange={(checklist) => onChange({ checklist })} />
      )}
      <div className="notes-color-row">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`note-color-swatch note-color-swatch--${c}${node.color === c ? " note-color-swatch--active" : ""}`}
            onClick={() => onChange({ color: c })}
          />
        ))}
      </div>
      <div className="job-modal-actions">
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
  const { notes } = useNotes();
  const [nodes, setNodes] = useState(canvas.nodes || []);
  const [edges, setEdges] = useState(canvas.edges || []);
  const [selectedId, setSelectedId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [connecting, setConnecting] = useState(null); // { fromId, x, y } in world coords
  const panRef = useRef(null);
  const viewportRef = useRef(null);
  const saveTimer = useRef(null);
  const undoStack = useRef([]);
  const redoStack = useRef([]);

  const selected = nodes.find((n) => n.id === selectedId) || null;

  const scheduleSave = useCallback(
    (nextNodes, nextEdges) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          const res = await writeVaultCanvas(projectId, canvas.id, { ...canvas, nodes: nextNodes, edges: nextEdges });
          onSaved(res.data);
        } catch {
          /* transient — next edit retries */
        }
      }, 600);
    },
    [projectId, canvas, onSaved]
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
  }, [nodes, edges, scheduleSave]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push({ nodes, edges });
    setNodes(next.nodes);
    setEdges(next.edges);
    scheduleSave(next.nodes, next.edges);
  }, [nodes, edges, scheduleSave]);

  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== "z") return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // Inspector field edits (title/body/ref/color/checklist) intentionally
  // don't push undo history — undo covers structural actions (add/delete/
  // duplicate node, drag, resize, connect), not every keystroke, or typing
  // one word into a title would bury the drag you actually want to undo
  // under dozens of one-character text-edit steps.
  const updateSelectedNode = (patch) => {
    commit(
      nodes.map((n) => (n.id === selectedId ? { ...n, ...patch } : n)),
      edges,
      { pushHistory: false }
    );
  };

  const addNode = (type) => {
    const centerX = (240 - pan.x) / zoom;
    const centerY = (200 - pan.y) / zoom;
    const node = newNode(type, snap(centerX, snapEnabled), snap(centerY, snapEnabled));
    commit([...nodes, node], edges);
    setSelectedId(node.id);
  };

  const duplicateNode = () => {
    if (!selected) return;
    const copy = { ...selected, id: uid(), x: selected.x + 24, y: selected.y + 24, checklist: selected.checklist.map((c) => ({ ...c })) };
    commit([...nodes, copy], edges);
    setSelectedId(copy.id);
  };

  const deleteNode = () => {
    if (!selected) return;
    commit(
      nodes.filter((n) => n.id !== selected.id),
      edges.filter((e) => e.from !== selected.id && e.to !== selected.id)
    );
    setSelectedId(null);
  };

  const deleteEdge = (edgeId) => {
    commit(nodes, edges.filter((e) => e.id !== edgeId));
  };

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
      const target = nodes.find((n) => p.x >= n.x && p.x <= n.x + n.w && p.y >= n.y && p.y <= n.y + n.h);
      setConnecting(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (target && target.id !== fromId) {
        const exists = edges.some((e) => (e.from === fromId && e.to === target.id) || (e.from === target.id && e.to === fromId));
        if (!exists) commit(nodes, [...edges, { id: uid(), from: fromId, to: target.id }]);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onBackgroundPointerDown = (e) => {
    if (e.target !== panRef.current) return;
    setSelectedId(null);
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

  return (
    <div className="project-canvas-editor">
      <div className="project-section-head">
        <button type="button" className="btn-pill" onClick={onBack}>
          ← canvases
        </button>
        <p className="panel-section-title" style={{ marginBottom: 0 }}>
          {canvas.name}
        </p>
        <GlassToolbar className="canvas-history-toolbar">
          <GlassButton variant="secondary" size="sm" onClick={undo} disabled={undoStack.current.length === 0} title="Undo (Ctrl/Cmd+Z)">
            ↶ undo
          </GlassButton>
          <GlassButton variant="secondary" size="sm" onClick={redo} disabled={redoStack.current.length === 0} title="Redo (Ctrl/Cmd+Shift+Z)">
            ↷ redo
          </GlassButton>
          <GlassButton variant={snapEnabled ? "primary" : "secondary"} size="sm" onClick={() => setSnapEnabled((s) => !s)} title="Snap to grid">
            # snap
          </GlassButton>
        </GlassToolbar>
        <span className="mono panel-empty">zoom {Math.round(zoom * 100)}%</span>
      </div>

      <GlassToolbar className="canvas-toolbar">
        {NODE_TYPES.map((t) => (
          <button key={t.key} type="button" className="canvas-toolbar-btn" onClick={() => addNode(t.key)} title={`Add ${t.label}`}>
            <span>{t.glyph}</span>
            {t.label}
          </button>
        ))}
      </GlassToolbar>

      <div className="project-canvas-body">
        <div ref={viewportRef} className="canvas-viewport" onPointerDown={onBackgroundPointerDown} onWheel={onWheel}>
          <div ref={panRef} className={`canvas-world${snapEnabled ? " canvas-world--grid" : ""}`} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
            <EdgeLayer nodes={nodes} edges={edges} connecting={connecting} onDeleteEdge={deleteEdge} />
            {nodes.map((n) => (
              <NodeShell
                key={n.id}
                node={n}
                zoom={zoom}
                selected={n.id === selectedId}
                onSelect={setSelectedId}
                onDragStart={onDragNodeStart}
                onDrag={onDragNode}
                onStartConnect={onStartConnect}
                onResizeStart={onResizeStart}
              >
                <div className="canvas-node-inner">
                  <NodeContent node={n} notes={notes} />
                </div>
              </NodeShell>
            ))}
            {nodes.length === 0 && (
              <div className="canvas-empty-hint">
                <p className="canvas-empty-hint-title">Empty canvas</p>
                <p className="canvas-empty-hint-body">Add a shape from the toolbar above, then drag from a selected node's dot to connect it to another.</p>
              </div>
            )}
          </div>

          {/* Floats ON TOP of the viewport instead of sharing a grid column
              with it — the board's own box size never changes whether or
              not this is open, so selecting a node can't yank the canvas
              sideways out from under a drag gesture the way the old
              always-reserved column did (see git history). Absolute inside
              .canvas-viewport specifically, not project-canvas-body, so it
              never overlaps the toolbar above it. */}
          <AnimatePresence>
            {selected && (
              <motion.div
                key={selected.id}
                className="canvas-inspector-drawer"
                initial={{ x: 24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 24, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 36 }}
              >
                <NodeInspector
                  node={selected}
                  notes={notes}
                  onChange={updateSelectedNode}
                  onDelete={deleteNode}
                  onDuplicate={duplicateNode}
                  onClose={() => setSelectedId(null)}
                />
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
export function ProjectCanvas({ project, tagFilter }) {
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
          Canvases
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
                {c.nodes?.length || 0} nodes · {c.edges?.length || 0} edges
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
