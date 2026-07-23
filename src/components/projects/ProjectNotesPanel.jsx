import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { plainTextPreview } from "../../lib/markdownLite.js";
import { useNotes } from "../../state/Notes.jsx";
import { useViewMode } from "../../state/ViewMode.jsx";
import { fetchVaultCanvases, writeVaultCanvas } from "../../lib/obsidianBridge.js";
import { GlassButton } from "../ui/GlassButton.jsx";

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function ImportNotesModal({ project, notes, onLink, onClose }) {
  const [query, setQuery] = useState("");
  const available = notes.filter((n) => !project.linkedNoteIds.includes(n.id) && !n.archived);
  const filtered = query.trim()
    ? available.filter((n) => n.title.toLowerCase().includes(query.toLowerCase()) || n.body.toLowerCase().includes(query.toLowerCase()))
    : available;

  return (
    <motion.div className="job-modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="glass-card job-modal"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: "spring", stiffness: 460, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Link existing note"
      >
        <p className="panel-section-title">Link a note into "{project.name || "Untitled project"}"</p>
        <input className="job-modal-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes…" autoFocus />
        <div className="import-notes-list">
          {filtered.length === 0 && <p className="panel-empty">{notes.length === 0 ? "No notes exist yet — create one below first." : "No matching notes."}</p>}
          {filtered.map((n) => (
            <button
              key={n.id}
              type="button"
              className="import-notes-item"
              onClick={() => {
                onLink(n.id);
                onClose();
              }}
            >
              <span className="import-notes-item-title">{n.title || "Untitled"}</span>
              <span className="import-notes-item-preview">{plainTextPreview(n.body, 70)}</span>
            </button>
          ))}
        </div>
        <div className="job-modal-actions">
          <GlassButton variant="secondary" onClick={onClose}>
            close
          </GlassButton>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ImportTextModal({ project, onCreate, onClose }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const onImport = async () => {
    if (!title.trim() && !body.trim()) return;
    setSaving(true);
    try {
      await onCreate({ title: title.trim() || "Untitled", body });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div className="job-modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="glass-card job-modal"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: "spring", stiffness: 460, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Import text into project note"
      >
        <p className="panel-section-title">New note in "{project.name || "Untitled project"}"</p>
        <p className="panel-empty">Paste or write markdown/text — it's saved as a real note in the vault, linked to this project.</p>
        <label className="job-modal-label mono">
          Title
          <input className="job-modal-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title" autoFocus />
        </label>
        <label className="job-modal-label mono">
          Content
          <textarea className="job-modal-textarea mono" value={body} onChange={(e) => setBody(e.target.value)} rows={8} placeholder="Paste or write markdown here…" />
        </label>
        <div className="job-modal-actions">
          <GlassButton variant="secondary" onClick={onClose} disabled={saving}>
            cancel
          </GlassButton>
          <GlassButton variant="primary" onClick={onImport} disabled={saving}>
            {saving ? "saving…" : "create + link"}
          </GlassButton>
        </div>
      </motion.div>
    </motion.div>
  );
}

/*
  ProjectNotesPanel — notes stay global (see state/Notes.jsx); a project
  only ever holds *references* (linkedNoteIds), never a forked copy. Three
  ways a note ends up linked here: create-fresh, link-existing, or
  import-pasted-text — all three just create/reuse a normal global note and
  link it, so nothing here is a project-only note type.
*/
export function ProjectNotesPanel({ project, notes, onLinkNote, onUnlinkNote, onCreateNote, onOpenCanvas, tagFilter }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [sendingToCanvasId, setSendingToCanvasId] = useState(null);
  const [linkError, setLinkError] = useState(null);
  const { requestSelectNote } = useNotes();
  const { goTo } = useViewMode();
  const linkedNotesAll = project.linkedNoteIds.map((id) => notes.find((n) => n.id === id)).filter(Boolean);
  const linkedNotes = tagFilter ? linkedNotesAll.filter((n) => (n.tags || []).includes(tagFilter)) : linkedNotesAll;

  // Open the fresh note in the real Notes editor (title/body/tags/
  // checklist) straight away, same as clicking "+ new note" from Notes
  // itself — not just leave it sitting linked-but-unnamed in this list.
  const onQuickCreate = async () => {
    const id = await onCreateNote({ title: "", body: "" });
    if (!id) return;
    onLinkNote(id);
    requestSelectNote(id);
    goTo("notes");
  };

  // Cross-linking (CLAUDE-004) — "create canvas node from note": drops a
  // real note-ref node (same shape ProjectCanvas's own "Note ref" toolbar
  // button creates) onto this project's first canvas, creating one first
  // if none exist yet, then jumps straight there via onOpenCanvas. Reuses
  // the exact same writeVaultCanvas call the Canvas tab itself uses — no
  // separate write path to drift out of sync with.
  const onSendToCanvas = async (note) => {
    setSendingToCanvasId(note.id);
    setLinkError(null);
    try {
      const res = await fetchVaultCanvases(project.id);
      const canvases = res.data || [];
      const noteNode = { id: uid(), type: "note", x: 60, y: 60, w: 240, h: 150, title: note.title || "Untitled", body: "", color: "teal", tags: [], checklist: [], ref: { noteId: note.id } };
      let targetId;
      if (canvases.length > 0) {
        const target = canvases[0];
        const write = await writeVaultCanvas(project.id, target.id, { ...target, nodes: [...(target.nodes || []), noteNode] });
        targetId = write.data.id;
      } else {
        const write = await writeVaultCanvas(project.id, null, { name: "Canvas", tags: [], nodes: [noteNode], edges: [] });
        targetId = write.data.id;
      }
      onOpenCanvas(targetId);
    } catch (err) {
      setLinkError(err.message || String(err));
    } finally {
      setSendingToCanvasId(null);
    }
  };

  return (
    <div className="panel-section">
      <div className="project-section-head">
        <p className="panel-section-title" style={{ marginBottom: 0 }}>
          Notes ({linkedNotes.length}{tagFilter ? ` of ${linkedNotesAll.length}` : ""})
        </p>
        <button type="button" className="btn-pill" onClick={onQuickCreate}>
          + new project note
        </button>
        <button type="button" className="btn-pill" onClick={() => setImportOpen(true)}>
          + import text
        </button>
        <button type="button" className="btn-pill" onClick={() => setLinkOpen(true)}>
          + link existing note
        </button>
      </div>

      {linkError && <p className="panel-error">Couldn't send note to canvas: {linkError}</p>}

      {linkedNotes.length === 0 && (
        <p className="panel-empty">
          {tagFilter ? `No linked notes tagged #${tagFilter}.` : "No notes linked yet. Free notes stay global — linking here doesn't move or copy them."}
        </p>
      )}
      <AnimatePresence initial={false}>
        {linkedNotes.map((n) => (
          <motion.div key={n.id} className="linked-note-row" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <div className="linked-note-info">
              <span className="linked-note-title">{n.title || "Untitled"}</span>
              <span className="linked-note-preview">{plainTextPreview(n.body, 90)}</span>
            </div>
            <div className="linked-note-actions">
              <button type="button" className="btn-pill" disabled={sendingToCanvasId === n.id} onClick={() => onSendToCanvas(n)} title="Create a canvas node referencing this note">
                {sendingToCanvasId === n.id ? "sending…" : "+ canvas"}
              </button>
              <button type="button" className="btn-pill" onClick={() => onUnlinkNote(n.id)}>
                unlink
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {linkOpen && <ImportNotesModal project={project} notes={notes} onLink={onLinkNote} onClose={() => setLinkOpen(false)} />}
        {importOpen && <ImportTextModal project={project} onCreate={onQuickCreateWithContent(onCreateNote, onLinkNote)} onClose={() => setImportOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}

function onQuickCreateWithContent(onCreateNote, onLinkNote) {
  return async ({ title, body }) => {
    const id = await onCreateNote({ title, body, tags: ["imported"] });
    if (id) onLinkNote(id);
  };
}
