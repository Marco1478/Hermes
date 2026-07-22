import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useNotes } from "../../../state/Notes.jsx";
import { fetchVaultCanvases, writeVaultCanvas, archiveVaultCanvas } from "../../../lib/obsidianBridge.js";
import { parseTagsInput } from "../../../lib/tags.js";
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

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function newNode(type, x, y) {
  return { id: uid(), type, x, y, w: 220, h: type === "circle" ? 140 : 130, title: "", body: "", color: "teal", tags: [], checklist: [], ref: null };
}

function NodeShell({ node, zoom, selected, onSelect, onDrag, children }) {
  return (
    <motion.div
      className={`canvas-node canvas-node--${node.type}${selected ? " canvas-node--selected" : ""}${node.color ? ` canvas-node--${node.color}` : ""}`}
      style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
      drag
      dragMomentum={false}
      onDrag={(e, info) => onDrag(node.id, info.delta.x / zoom, info.delta.y / zoom)}
      whileDrag={{ zIndex: 20, cursor: "grabbing" }}
    >
      {children}
    </motion.div>
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
  if (node.type === "image" || node.type === "file") {
    return (
      <>
        <p className="canvas-node-title">{node.type === "image" ? "🖼" : "📄"} {node.title || (node.type === "image" ? "Image reference" : "File reference")}</p>
        <p className="canvas-node-sub canvas-node-ref">{node.ref?.url || "no URL/path set"}</p>
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

function NodeInspector({ node, notes, onChange, onDelete, onClose }) {
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
        <label className="job-modal-label mono">
          URL / vault asset path
          <input className="job-modal-input" value={node.ref?.url || ""} onChange={(e) => onChange({ ref: { url: e.target.value } })} placeholder="https://… or Hermes/Projects/…/assets/…" />
        </label>
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
      <button type="button" className="btn-pill btn-pill--danger" onClick={onDelete}>
        delete node
      </button>
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

function CanvasEditor({ projectId, canvas, onBack, onSaved }) {
  const { notes } = useNotes();
  const [nodes, setNodes] = useState(canvas.nodes || []);
  const [selectedId, setSelectedId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef(null);
  const saveTimer = useRef(null);

  const selected = nodes.find((n) => n.id === selectedId) || null;

  const scheduleSave = useCallback(
    (nextNodes) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          const res = await writeVaultCanvas(projectId, canvas.id, { ...canvas, nodes: nextNodes });
          onSaved(res.data);
        } catch {
          /* transient — next edit retries */
        }
      }, 600);
    },
    [projectId, canvas, onSaved]
  );

  const updateNodes = (updater) => {
    setNodes((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      scheduleSave(next);
      return next;
    });
  };

  const addNode = (type) => {
    const centerX = (240 - pan.x) / zoom;
    const centerY = (200 - pan.y) / zoom;
    const node = newNode(type, centerX, centerY);
    updateNodes((prev) => [...prev, node]);
    setSelectedId(node.id);
  };

  // Same debounced-save path as any other edit (updateNodes) — scheduleSave
  // is called on every drag tick, but its own debounce coalesces a whole
  // drag gesture into one write ~600ms after the last movement. Simpler
  // and more reliable than trying to detect "drag end" precisely: no risk
  // of a save being lost to a stale ref if a dedicated end-of-drag handler
  // fires before React commits the final position.
  const onDragNode = (id, dx, dy) => {
    setNodes((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, x: n.x + dx, y: n.y + dy } : n));
      scheduleSave(next);
      return next;
    });
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
        <span className="mono panel-empty">zoom {Math.round(zoom * 100)}%</span>
      </div>

      <div className="canvas-toolbar">
        {NODE_TYPES.map((t) => (
          <button key={t.key} type="button" className="canvas-toolbar-btn" onClick={() => addNode(t.key)} title={`Add ${t.label}`}>
            <span>{t.glyph}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="project-canvas-body">
        <div className="canvas-viewport" onPointerDown={onBackgroundPointerDown} onWheel={onWheel}>
          <div ref={panRef} className="canvas-world" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
            {nodes.map((n) => (
              <NodeShell key={n.id} node={n} zoom={zoom} selected={n.id === selectedId} onSelect={setSelectedId} onDrag={onDragNode}>
                <div className="canvas-node-inner">
                  <NodeContent node={n} notes={notes} />
                </div>
              </NodeShell>
            ))}
            {nodes.length === 0 && <p className="panel-empty canvas-empty-hint">Empty canvas — add a shape from the toolbar above.</p>}
          </div>
        </div>
        {selected && (
          <NodeInspector
            node={selected}
            notes={notes}
            onChange={(patch) => updateNodes((prev) => prev.map((n) => (n.id === selected.id ? { ...n, ...patch } : n)))}
            onDelete={() => {
              updateNodes((prev) => prev.filter((n) => n.id !== selected.id));
              setSelectedId(null);
            }}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  );
}

/*
  ProjectCanvas — a custom whiteboard, not Obsidian desktop `.canvas`
  (Marco doesn't work in Obsidian desktop). Each canvas is a JSON file
  under the project's canvases/ subfolder; node drag position and content
  edits save debounced (600ms) so it feels alive without hammering the
  vault on every pixel of movement.
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
              <span className="mono canvas-list-meta">{c.nodes?.length || 0} nodes</span>
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
