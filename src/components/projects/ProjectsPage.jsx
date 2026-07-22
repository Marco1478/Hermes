import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useProjects, STATUSES, PRIORITIES } from "../../state/Projects.jsx";
import { useNotes } from "../../state/Notes.jsx";
import { PageShell } from "../PageShell.jsx";
import { plainTextPreview } from "../../lib/markdownLite.js";
import "./ProjectsPage.css";

const STATUS_LABEL = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  done: "Done",
  archived: "Archived",
};

const STATUS_TONE = {
  planning: "",
  active: "info",
  on_hold: "warn",
  done: "ok",
  archived: "",
};

const COLORS = [
  { key: null, label: "none" },
  { key: "teal", label: "teal" },
  { key: "warn", label: "amber" },
  { key: "bad", label: "coral" },
  { key: "ok", label: "green" },
  { key: "violet", label: "violet" },
];

function fmtDate(ts) {
  if (!ts) return null;
  return new Date(ts).toLocaleDateString();
}

function progressOf(project) {
  if (!project.milestones.length) return null;
  return project.milestones.filter((m) => m.done).length / project.milestones.length;
}

function ProjectCard({ project, onOpen }) {
  const progress = progressOf(project);
  const overdue = project.dueDate && project.dueDate < Date.now() && project.status !== "done" && project.status !== "archived";
  return (
    <button type="button" className="project-card" onClick={() => onOpen(project.id)}>
      {project.color && <span className={`project-card-stripe project-card-stripe--${project.color}`} />}
      <div className="project-card-head">
        <span className="project-card-name">{project.name || "Untitled project"}</span>
        <span className={`status-badge status-badge--${STATUS_TONE[project.status]}`}>{STATUS_LABEL[project.status]}</span>
      </div>
      {project.description && <p className="project-card-desc">{plainTextPreview(project.description, 110)}</p>}
      {progress != null && (
        <div className="project-card-progress">
          <div className="project-card-progress-track">
            <div className="project-card-progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <span className="mono">{project.milestones.filter((m) => m.done).length}/{project.milestones.length}</span>
        </div>
      )}
      <div className="project-card-meta mono">
        <span className={`tag-badge project-priority project-priority--${project.priority}`}>{project.priority}</span>
        {project.dueDate && <span className={overdue ? "project-overdue" : ""}>due {fmtDate(project.dueDate)}</span>}
        {project.linkedNoteIds.length > 0 && <span>{project.linkedNoteIds.length} note{project.linkedNoteIds.length > 1 ? "s" : ""}</span>}
      </div>
    </button>
  );
}

function ImportNotesModal({ project, notes, onLink, onClose }) {
  const [query, setQuery] = useState("");
  const available = notes.filter((n) => !project.linkedNoteIds.includes(n.id));
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
        aria-label="Import notes"
      >
        <p className="panel-section-title">Import notes into "{project.name || "Untitled project"}"</p>
        <input
          className="job-modal-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes…"
          autoFocus
        />
        <div className="import-notes-list">
          {filtered.length === 0 && <p className="panel-empty">{notes.length === 0 ? "No notes exist yet — create some in the Notes tab first." : "No matching notes."}</p>}
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
          <button type="button" className="btn-pill" onClick={onClose}>
            close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ProjectDrawer({ project, notes, onClose, onUpdate, onDelete, onAddMilestone, onToggleMilestone, onRemoveMilestone, onLinkNote, onUnlinkNote }) {
  const [newMilestone, setNewMilestone] = useState("");
  const [newTag, setNewTag] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  const linkedNotes = project.linkedNoteIds.map((id) => notes.find((n) => n.id === id)).filter(Boolean);
  const progress = progressOf(project);

  const addTag = () => {
    const t = newTag.trim();
    if (!t) return;
    if (!project.tags.includes(t)) onUpdate({ tags: [...project.tags, t] });
    setNewTag("");
  };

  return (
    <motion.div className="kanban-drawer-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="glass-card kanban-drawer"
        initial={{ opacity: 0, x: 36 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 36 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Project detail"
      >
        <button type="button" className="btn-pill kanban-drawer-close" onClick={onClose}>
          close
        </button>

        <input
          className="notes-title-input"
          value={project.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Untitled project"
        />

        <div className="project-drawer-row">
          <label className="notes-meta-label mono">
            status
            <select className="notes-meta-select mono" value={project.status} onChange={(e) => onUpdate({ status: e.target.value })}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="notes-meta-label mono">
            priority
            <select className="notes-meta-select mono" value={project.priority} onChange={(e) => onUpdate({ priority: e.target.value })}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="notes-meta-label mono">
            due
            <input
              type="date"
              className="notes-meta-select mono"
              value={project.dueDate ? new Date(project.dueDate).toISOString().slice(0, 10) : ""}
              onChange={(e) => onUpdate({ dueDate: e.target.value ? new Date(e.target.value).getTime() : null })}
            />
          </label>
        </div>

        <div className="notes-meta-label mono">
          color
          <div className="notes-color-row">
            {COLORS.map((c) => (
              <button
                key={c.label}
                type="button"
                className={`note-color-swatch note-color-swatch--${c.key || "none"}${project.color === c.key ? " note-color-swatch--active" : ""}`}
                title={c.label}
                aria-label={c.label}
                onClick={() => onUpdate({ color: c.key })}
              />
            ))}
          </div>
        </div>

        <div className="notes-tags-row">
          {project.tags.map((t) => (
            <span key={t} className="tag-badge notes-tag-chip">
              #{t}
              <button type="button" onClick={() => onUpdate({ tags: project.tags.filter((x) => x !== t) })} aria-label={`Remove tag ${t}`}>
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

        <div className="panel-section">
          <p className="panel-section-title">Description</p>
          <textarea
            className="notes-body-textarea mono project-desc-textarea"
            value={project.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="What is this project about?"
          />
        </div>

        <div className="notes-checklist">
          <p className="panel-section-title" style={{ marginBottom: 0 }}>
            Milestones {project.milestones.length > 0 && <span className="mono">({project.milestones.filter((m) => m.done).length}/{project.milestones.length})</span>}
          </p>
          {progress != null && (
            <div className="notes-checklist-progress">
              <div className="notes-checklist-progress-fill" style={{ width: `${progress * 100}%` }} />
            </div>
          )}
          <AnimatePresence initial={false}>
            {project.milestones.map((m) => (
              <motion.div key={m.id} className="notes-checklist-item" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <label className="notes-checklist-label">
                  <input type="checkbox" checked={m.done} onChange={() => onToggleMilestone(m.id)} />
                  <span className={m.done ? "notes-checklist-done" : ""}>{m.text}</span>
                </label>
                <button type="button" className="notes-checklist-remove" onClick={() => onRemoveMilestone(m.id)} aria-label="Remove milestone">
                  ×
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          <form
            className="notes-checklist-add"
            onSubmit={(e) => {
              e.preventDefault();
              if (newMilestone.trim()) onAddMilestone(newMilestone.trim());
              setNewMilestone("");
            }}
          >
            <input
              className="notes-checklist-input mono"
              value={newMilestone}
              onChange={(e) => setNewMilestone(e.target.value)}
              placeholder="+ milestone…"
            />
          </form>
        </div>

        <div className="panel-section">
          <div className="project-section-head">
            <p className="panel-section-title" style={{ marginBottom: 0 }}>
              Linked notes ({linkedNotes.length})
            </p>
            <button type="button" className="btn-pill" onClick={() => setImportOpen(true)}>
              + import notes
            </button>
          </div>
          {linkedNotes.length === 0 && <p className="panel-empty">No notes linked yet.</p>}
          {linkedNotes.map((n) => (
            <div key={n.id} className="linked-note-row">
              <div className="linked-note-info">
                <span className="linked-note-title">{n.title || "Untitled"}</span>
                <span className="linked-note-preview">{plainTextPreview(n.body, 90)}</span>
              </div>
              <button type="button" className="btn-pill" onClick={() => onUnlinkNote(n.id)}>
                unlink
              </button>
            </div>
          ))}
        </div>

        <div className="job-modal-actions">
          <button
            type="button"
            className="btn-pill btn-pill--danger"
            onClick={() => {
              if (window.confirm("Delete this project? Linked notes are kept, just unlinked.")) onDelete();
            }}
          >
            delete project
          </button>
        </div>

        <AnimatePresence>
          {importOpen && (
            <ImportNotesModal
              project={project}
              notes={notes}
              onLink={onLinkNote}
              onClose={() => setImportOpen(false)}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

/*
  ProjectsPage — a local-first project tracker (see state/Projects.jsx for
  why local-first is honest here) that sits on top of Notes: each project
  can import/link existing notes rather than duplicating their content.
*/
export function ProjectsPage() {
  const { projects, allTags, createProject, updateProject, deleteProject, addMilestone, toggleMilestone, removeMilestone, linkNote, unlinkNote } =
    useProjects();
  const { notes } = useNotes();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState(null);
  const [sort, setSort] = useState("updated");
  const [openId, setOpenId] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = projects;
    if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter);
    if (tagFilter) list = list.filter((p) => p.tags.includes(tagFilter));
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    const priorityRank = { high: 0, medium: 1, low: 2 };
    return [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "created") return b.createdAt - a.createdAt;
      if (sort === "priority") return priorityRank[a.priority] - priorityRank[b.priority];
      if (sort === "due") return (a.dueDate || Infinity) - (b.dueDate || Infinity);
      return b.updatedAt - a.updatedAt;
    });
  }, [projects, query, statusFilter, tagFilter, sort]);

  const openProject = projects.find((p) => p.id === openId) || null;

  const onNewProject = () => {
    const id = createProject({});
    setOpenId(id);
  };

  const statusCounts = useMemo(() => {
    const counts = { all: projects.length };
    for (const s of STATUSES) counts[s] = projects.filter((p) => p.status === s).length;
    return counts;
  }, [projects]);

  return (
    <PageShell
      title="Projects"
      wide
      headerExtra={
        <button type="button" className="btn-pill" onClick={onNewProject}>
          + new project
        </button>
      }
    >
      <div className="projects-toolbar">
        <input
          type="text"
          className="notes-search mono"
          placeholder={`Search ${projects.length} projects…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="notes-sort-select mono" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="updated">last edited</option>
          <option value="created">date created</option>
          <option value="name">name A→Z</option>
          <option value="priority">priority</option>
          <option value="due">due date</option>
        </select>
      </div>

      <div className="projects-status-tabs">
        <button type="button" className={`btn-pill${statusFilter === "all" ? " btn-pill--active" : ""}`} onClick={() => setStatusFilter("all")}>
          all <span className="mono">{statusCounts.all}</span>
        </button>
        {STATUSES.map((s) => (
          <button key={s} type="button" className={`btn-pill${statusFilter === s ? " btn-pill--active" : ""}`} onClick={() => setStatusFilter(s)}>
            {STATUS_LABEL[s]} <span className="mono">{statusCounts[s]}</span>
          </button>
        ))}
      </div>

      {allTags.length > 0 && (
        <div className="notes-tags-filter-list">
          {allTags.map((t) => (
            <button
              key={t}
              type="button"
              className={`tag-badge notes-tag-pill${tagFilter === t ? " notes-tag-pill--active" : ""}`}
              onClick={() => setTagFilter((cur) => (cur === t ? null : t))}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      <div className="projects-grid">
        {filtered.length === 0 && <p className="panel-empty">No projects match. Create one to get started.</p>}
        {filtered.map((p) => (
          <ProjectCard key={p.id} project={p} onOpen={setOpenId} />
        ))}
      </div>

      <AnimatePresence>
        {openProject && (
          <ProjectDrawer
            project={openProject}
            notes={notes}
            onClose={() => setOpenId(null)}
            onUpdate={(patch) => updateProject(openProject.id, patch)}
            onDelete={() => {
              deleteProject(openProject.id);
              setOpenId(null);
            }}
            onAddMilestone={(text) => addMilestone(openProject.id, text)}
            onToggleMilestone={(itemId) => toggleMilestone(openProject.id, itemId)}
            onRemoveMilestone={(itemId) => removeMilestone(openProject.id, itemId)}
            onLinkNote={(noteId) => linkNote(openProject.id, noteId)}
            onUnlinkNote={(noteId) => unlinkNote(openProject.id, noteId)}
          />
        )}
      </AnimatePresence>
    </PageShell>
  );
}
