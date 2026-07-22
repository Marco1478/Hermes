import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNotes } from "../../state/Notes.jsx";
import { useProjects } from "../../state/Projects.jsx";
import { PageShell } from "../PageShell.jsx";
import { VaultStatusChip } from "../VaultStatusChip.jsx";
import { renderMarkdownLite, wordCount, plainTextPreview } from "../../lib/markdownLite.js";
import { downloadText, slugify } from "../../lib/exportChat.js";
import "./NotesPage.css";

const COLORS = [
  { key: null, label: "none" },
  { key: "teal", label: "teal" },
  { key: "warn", label: "amber" },
  { key: "bad", label: "coral" },
  { key: "ok", label: "green" },
  { key: "violet", label: "violet" },
];

const SORTS = [
  { key: "updated", label: "last edited" },
  { key: "created", label: "date created" },
  { key: "title", label: "title A→Z" },
];

function timeAgo(ts) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

function NoteListItem({ note, active, onSelect, usageCount }) {
  return (
    <button type="button" className={`note-list-item${active ? " note-list-item--active" : ""}`} onClick={() => onSelect(note.id)}>
      {note.color && <span className={`note-color-dot note-color-dot--${note.color}`} />}
      <div className="note-list-item-body">
        <div className="note-list-item-head">
          {note.pinned && <span className="note-pin-icon" title="Pinned">★</span>}
          <span className="note-list-item-title">{note.title || "Untitled"}</span>
        </div>
        <p className="note-list-item-preview">{plainTextPreview(note.body) || "No content yet."}</p>
        <div className="note-list-item-meta mono">
          <span>{timeAgo(note.updatedAt)}</span>
          {note.checklist.length > 0 && (
            <span>
              {note.checklist.filter((c) => c.done).length}/{note.checklist.length} done
            </span>
          )}
          {usageCount > 0 && <span>in {usageCount} project{usageCount > 1 ? "s" : ""}</span>}
        </div>
      </div>
    </button>
  );
}

function NewFolderRow({ onCreate }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  if (!creating) {
    return (
      <button type="button" className="notes-folder-new" onClick={() => setCreating(true)}>
        + new folder
      </button>
    );
  }
  return (
    <form
      className="notes-folder-new-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onCreate(name.trim());
        setName("");
        setCreating(false);
      }}
    >
      <input
        className="notes-folder-new-input mono"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => setCreating(false)}
        placeholder="Folder name…"
      />
    </form>
  );
}

/*
  NotesPage — a full local-first notes app (see state/Notes.jsx for why
  local-first is the honest choice here, not a placeholder for a missing
  backend). Two-pane layout: folders/search/list on the left, the full
  editor (title, tags, color, checklist, markdown body + live preview) on
  the right — the same information-density posture as Kanban's board.
*/
export function NotesPage() {
  const {
    notes,
    folders,
    allTags,
    vaultStatus,
    vaultError,
    orphanedLocalNotes,
    migrating,
    migrateLocalNotesToVault,
    createNote,
    updateNote,
    deleteNote,
    duplicateNote,
    togglePin,
    toggleArchive,
    addChecklistItem,
    toggleChecklistItem,
    removeChecklistItem,
    createFolder,
    renameFolder,
    deleteFolder,
  } = useNotes();
  const { projects } = useProjects();

  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [activeFolder, setActiveFolder] = useState("all"); // "all" | "unfiled" | folder name
  const [activeTag, setActiveTag] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [linkFilter, setLinkFilter] = useState("all"); // "all" | "free" | "linked"
  const [sort, setSort] = useState("updated");
  const [preview, setPreview] = useState(true);
  const [newChecklistText, setNewChecklistText] = useState("");
  const [newTag, setNewTag] = useState("");

  const usageByNoteId = useMemo(() => {
    const counts = new Map();
    for (const p of projects) for (const nid of p.linkedNoteIds || []) counts.set(nid, (counts.get(nid) || 0) + 1);
    return counts;
  }, [projects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = notes.filter((n) => Boolean(n.archived) === showArchived);
    if (activeFolder === "unfiled") list = list.filter((n) => !n.folder);
    else if (activeFolder !== "all") list = list.filter((n) => n.folder === activeFolder);
    if (activeTag) list = list.filter((n) => (n.tags || []).includes(activeTag));
    if (linkFilter === "free") list = list.filter((n) => !usageByNoteId.get(n.id));
    else if (linkFilter === "linked") list = list.filter((n) => usageByNoteId.get(n.id));
    if (q) {
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q) ||
          (n.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }
    const sorted = [...list].sort((a, b) => {
      if (sort === "title") return (a.title || "").localeCompare(b.title || "");
      if (sort === "created") return b.createdAt - a.createdAt;
      return b.updatedAt - a.updatedAt;
    });
    sorted.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    return sorted;
  }, [notes, query, activeFolder, activeTag, showArchived, sort, linkFilter, usageByNoteId]);

  useEffect(() => {
    if (selectedId && !notes.some((n) => n.id === selectedId)) setSelectedId(null);
  }, [notes, selectedId]);

  const selected = notes.find((n) => n.id === selectedId) || null;

  const onNewNote = async () => {
    const id = await createNote({ folder: activeFolder !== "all" && activeFolder !== "unfiled" ? activeFolder : null });
    if (id) setSelectedId(id);
    setShowArchived(false);
  };

  const onExport = (note) => {
    const lines = [`# ${note.title || "Untitled"}`, "", note.body || ""];
    if (note.checklist.length) {
      lines.push("", "## Checklist", "", ...note.checklist.map((c) => `- [${c.done ? "x" : " "}] ${c.text}`));
    }
    downloadText(`note-${slugify(note.title)}.md`, lines.join("\n"));
  };

  const addTag = () => {
    const t = newTag.trim();
    if (!t || !selected) return;
    if (!(selected.tags || []).includes(t)) updateNote(selected.id, { tags: [...(selected.tags || []), t] });
    setNewTag("");
  };

  const removeTag = (t) => {
    if (!selected) return;
    updateNote(selected.id, { tags: (selected.tags || []).filter((x) => x !== t) });
  };

  const doneCount = selected ? selected.checklist.filter((c) => c.done).length : 0;

  return (
    <PageShell
      title="Notes"
      wide
      headerExtra={
        <button type="button" className="btn-pill" onClick={onNewNote}>
          + new note
        </button>
      }
    >
      <div className="notes-shell">
        <aside className="notes-sidebar">
          <VaultStatusChip status={vaultStatus} error={vaultError} />

          {vaultStatus === "connected" && orphanedLocalNotes.length > 0 && (
            <div className="vault-migrate-banner">
              <span>
                {orphanedLocalNotes.length} note{orphanedLocalNotes.length > 1 ? "s" : ""} saved before the vault was connected.
              </span>
              <button type="button" className="btn-pill" disabled={migrating} onClick={migrateLocalNotesToVault}>
                {migrating ? "migrating…" : "migrate to vault"}
              </button>
            </div>
          )}

          <input
            type="text"
            className="notes-search mono"
            placeholder={`Search ${notes.length} notes…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <div className="notes-filter-row">
            <button type="button" className={`btn-pill${!showArchived ? " btn-pill--active" : ""}`} onClick={() => setShowArchived(false)}>
              active
            </button>
            <button type="button" className={`btn-pill${showArchived ? " btn-pill--active" : ""}`} onClick={() => setShowArchived(true)}>
              archived
            </button>
            <select className="notes-sort-select mono" value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="notes-filter-row">
            <button type="button" className={`btn-pill${linkFilter === "all" ? " btn-pill--active" : ""}`} onClick={() => setLinkFilter("all")}>
              all
            </button>
            <button type="button" className={`btn-pill${linkFilter === "free" ? " btn-pill--active" : ""}`} onClick={() => setLinkFilter("free")}>
              free
            </button>
            <button type="button" className={`btn-pill${linkFilter === "linked" ? " btn-pill--active" : ""}`} onClick={() => setLinkFilter("linked")}>
              in projects
            </button>
          </div>

          <div className="notes-folders">
            <p className="panel-section-title">Folders</p>
            <button type="button" className={`notes-folder-item${activeFolder === "all" ? " notes-folder-item--active" : ""}`} onClick={() => setActiveFolder("all")}>
              all notes <span className="mono">{notes.filter((n) => Boolean(n.archived) === showArchived).length}</span>
            </button>
            <button type="button" className={`notes-folder-item${activeFolder === "unfiled" ? " notes-folder-item--active" : ""}`} onClick={() => setActiveFolder("unfiled")}>
              unfiled <span className="mono">{notes.filter((n) => !n.folder && Boolean(n.archived) === showArchived).length}</span>
            </button>
            {folders.map((f) => (
              <div key={f} className="notes-folder-row">
                <button type="button" className={`notes-folder-item${activeFolder === f ? " notes-folder-item--active" : ""}`} onClick={() => setActiveFolder(f)}>
                  {f} <span className="mono">{notes.filter((n) => n.folder === f && Boolean(n.archived) === showArchived).length}</span>
                </button>
                <button
                  type="button"
                  className="notes-folder-delete"
                  title={`Delete folder "${f}" (notes are kept, unfiled)`}
                  onClick={() => {
                    if (window.confirm(`Delete folder "${f}"? Notes inside stay, just unfiled.`)) deleteFolder(f);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            <NewFolderRow onCreate={createFolder} />
          </div>

          {allTags.length > 0 && (
            <div className="notes-tags-filter">
              <p className="panel-section-title">Tags</p>
              <div className="notes-tags-filter-list">
                {allTags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`tag-badge notes-tag-pill${activeTag === t ? " notes-tag-pill--active" : ""}`}
                    onClick={() => setActiveTag((cur) => (cur === t ? null : t))}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="notes-list">
            {filtered.length === 0 && <p className="panel-empty">No notes here yet.</p>}
            {filtered.map((n) => (
              <NoteListItem key={n.id} note={n} active={n.id === selectedId} onSelect={setSelectedId} usageCount={usageByNoteId.get(n.id) || 0} />
            ))}
          </div>
        </aside>

        <section className="notes-editor">
          {!selected && (
            <div className="notes-editor-empty">
              <p className="panel-empty">Select a note, or create a new one.</p>
            </div>
          )}
          {selected && (
            <>
              <div className="notes-editor-top">
                <input
                  className="notes-title-input"
                  value={selected.title}
                  onChange={(e) => updateNote(selected.id, { title: e.target.value })}
                  placeholder="Untitled"
                />
                <div className="notes-editor-actions">
                  <button type="button" className="btn-pill" title="Pin" onClick={() => togglePin(selected.id)}>
                    {selected.pinned ? "★ pinned" : "☆ pin"}
                  </button>
                  <button type="button" className="btn-pill" onClick={() => duplicateNote(selected.id)}>
                    duplicate
                  </button>
                  <button type="button" className="btn-pill" onClick={() => onExport(selected)}>
                    export .md
                  </button>
                  <button type="button" className="btn-pill" onClick={() => toggleArchive(selected.id)}>
                    {selected.archived ? "unarchive" : "archive"}
                  </button>
                  {vaultStatus !== "connected" && (
                    <button
                      type="button"
                      className="btn-pill btn-pill--danger"
                      onClick={() => {
                        if (window.confirm("Delete this note? This cannot be undone.")) deleteNote(selected.id);
                      }}
                    >
                      delete
                    </button>
                  )}
                </div>
              </div>

              <div className="notes-editor-meta">
                <label className="notes-meta-label mono">
                  folder
                  <select
                    className="notes-meta-select mono"
                    value={selected.folder || ""}
                    onChange={(e) => updateNote(selected.id, { folder: e.target.value || null })}
                  >
                    <option value="">unfiled</option>
                    {folders.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="notes-meta-label mono">
                  color
                  <div className="notes-color-row">
                    {COLORS.map((c) => (
                      <button
                        key={c.label}
                        type="button"
                        className={`note-color-swatch note-color-swatch--${c.key || "none"}${selected.color === c.key ? " note-color-swatch--active" : ""}`}
                        title={c.label}
                        aria-label={c.label}
                        onClick={() => updateNote(selected.id, { color: c.key })}
                      />
                    ))}
                  </div>
                </div>

                <span className="notes-meta-timestamps mono">
                  created {new Date(selected.createdAt).toLocaleDateString()} · edited {timeAgo(selected.updatedAt)} · {wordCount(selected.body)} words
                </span>
              </div>

              <div className="notes-tags-row">
                {(selected.tags || []).map((t) => (
                  <span key={t} className="tag-badge notes-tag-chip">
                    #{t}
                    <button type="button" onClick={() => removeTag(t)} aria-label={`Remove tag ${t}`}>
                      ×
                    </button>
                  </span>
                ))}
                <input
                  className="notes-tag-input mono"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="+ tag"
                />
              </div>

              <div className="notes-checklist">
                <div className="notes-checklist-head">
                  <p className="panel-section-title" style={{ marginBottom: 0 }}>
                    Checklist {selected.checklist.length > 0 && <span className="mono">({doneCount}/{selected.checklist.length})</span>}
                  </p>
                </div>
                {selected.checklist.length > 0 && (
                  <div className="notes-checklist-progress">
                    <div className="notes-checklist-progress-fill" style={{ width: `${(doneCount / selected.checklist.length) * 100}%` }} />
                  </div>
                )}
                <AnimatePresence initial={false}>
                  {selected.checklist.map((c) => (
                    <motion.div
                      key={c.id}
                      className="notes-checklist-item"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <label className="notes-checklist-label">
                        <input type="checkbox" checked={c.done} onChange={() => toggleChecklistItem(selected.id, c.id)} />
                        <span className={c.done ? "notes-checklist-done" : ""}>{c.text}</span>
                      </label>
                      <button type="button" className="notes-checklist-remove" onClick={() => removeChecklistItem(selected.id, c.id)} aria-label="Remove item">
                        ×
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <form
                  className="notes-checklist-add"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (newChecklistText.trim()) addChecklistItem(selected.id, newChecklistText.trim());
                    setNewChecklistText("");
                  }}
                >
                  <input
                    className="notes-checklist-input mono"
                    value={newChecklistText}
                    onChange={(e) => setNewChecklistText(e.target.value)}
                    placeholder="+ checklist item…"
                  />
                </form>
              </div>

              <div className="notes-body-head">
                <p className="panel-section-title" style={{ marginBottom: 0 }}>
                  Body
                </p>
                <button type="button" className="btn-pill" onClick={() => setPreview((v) => !v)}>
                  {preview ? "edit" : "preview"}
                </button>
              </div>
              {preview ? (
                <div className="notes-body-preview" dangerouslySetInnerHTML={{ __html: renderMarkdownLite(selected.body) || '<p class="panel-empty">Nothing written yet.</p>' }} />
              ) : (
                <textarea
                  className="notes-body-textarea mono"
                  value={selected.body}
                  onChange={(e) => updateNote(selected.id, { body: e.target.value })}
                  placeholder="Write in Markdown — **bold**, *italic*, `code`, ```code blocks```, - [ ] tasks, # headings…"
                  spellCheck="false"
                />
              )}
            </>
          )}
        </section>
      </div>
    </PageShell>
  );
}
