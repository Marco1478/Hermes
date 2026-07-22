import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useProjects, STATUSES, PRIORITIES } from "../../state/Projects.jsx";
import { useNotes } from "../../state/Notes.jsx";
import { PageShell } from "../PageShell.jsx";
import { VaultStatusChip } from "../VaultStatusChip.jsx";
import { ProjectWorkspace } from "./ProjectWorkspace.jsx";
import { plainTextPreview } from "../../lib/markdownLite.js";
import { parseTagsInput } from "../../lib/tags.js";
import "./ProjectsPage.css";

const STATUS_LABEL = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  done: "Done",
};

const STATUS_TONE = {
  planning: "",
  active: "info",
  on_hold: "warn",
  done: "ok",
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
  const overdue = project.dueDate && project.dueDate < Date.now() && project.status !== "done" && !project.archived;
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

function NewProjectModal({ onCreate, onClose }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("planning");
  const [color, setColor] = useState(null);
  const [tagsText, setTagsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const onSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const tags = parseTagsInput(tagsText);
      await onCreate({ name: name.trim(), description, status, color, tags });
      onClose();
    } catch (err) {
      setError(err.message || String(err));
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
        aria-label="New project"
      >
        <p className="panel-section-title">New project</p>

        <label className="job-modal-label mono">
          Name
          <input className="job-modal-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" autoFocus />
        </label>

        <label className="job-modal-label mono">
          Description
          <textarea className="job-modal-textarea mono" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Optional summary" />
        </label>

        <label className="job-modal-label mono">
          Status
          <select className="notes-meta-select mono" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>

        <div className="notes-color-row">
          {COLORS.map((c) => (
            <button
              key={c.label}
              type="button"
              className={`note-color-swatch note-color-swatch--${c.key || "none"}${color === c.key ? " note-color-swatch--active" : ""}`}
              title={c.label}
              aria-label={c.label}
              onClick={() => setColor(c.key)}
            />
          ))}
        </div>

        <label className="job-modal-label mono">
          Tags
          <input className="job-modal-input" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="comma, separated, tags" />
        </label>

        {error && <p className="panel-error">{error}</p>}

        <div className="job-modal-actions">
          <button type="button" className="btn-pill" onClick={onClose} disabled={saving}>
            cancel
          </button>
          <button type="button" className="btn-pill" onClick={onSubmit} disabled={saving}>
            {saving ? "creating…" : "create"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/*
  ProjectsPage — list/grid of project cards; opening one switches this same
  tab into a full ProjectWorkspace (internal sidebar: Overview/Notes/
  Canvas/Workflows/Kanban/Chat/Intelligence) instead of a slide-over drawer
  — a project is a self-contained operational space, not just a card.
*/
export function ProjectsPage() {
  const {
    projects,
    allTags,
    vaultStatus,
    vaultError,
    orphanedLocalProjects,
    migrating,
    migrateLocalProjectsToVault,
    createProject,
    updateProject,
    deleteProject,
    toggleArchiveProject,
    addMilestone,
    toggleMilestone,
    removeMilestone,
    linkNote,
    unlinkNote,
  } = useProjects();
  const { notes, createNote } = useNotes();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [tagFilter, setTagFilter] = useState(null);
  const [sort, setSort] = useState("updated");
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = projects.filter((p) => Boolean(p.archived) === showArchived);
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
  }, [projects, query, statusFilter, tagFilter, sort, showArchived]);

  const openProject = projects.find((p) => p.id === openId) || null;

  const statusCounts = useMemo(() => {
    const visible = projects.filter((p) => Boolean(p.archived) === showArchived);
    const counts = { all: visible.length };
    for (const s of STATUSES) counts[s] = visible.filter((p) => p.status === s).length;
    return counts;
  }, [projects, showArchived]);

  if (openProject) {
    return (
      <PageShell title="Projects" wide>
        <ProjectWorkspace
          project={openProject}
          notes={notes}
          vaultStatus={vaultStatus}
          onBack={() => setOpenId(null)}
          onUpdate={(patch) => updateProject(openProject.id, patch)}
          onDelete={() => {
            deleteProject(openProject.id);
            setOpenId(null);
          }}
          onToggleArchive={() => toggleArchiveProject(openProject.id)}
          milestoneActions={{
            add: (text) => addMilestone(openProject.id, text),
            toggle: (itemId) => toggleMilestone(openProject.id, itemId),
            remove: (itemId) => removeMilestone(openProject.id, itemId),
          }}
          noteActions={{
            link: (noteId) => linkNote(openProject.id, noteId),
            unlink: (noteId) => unlinkNote(openProject.id, noteId),
            create: createNote,
          }}
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Projects"
      wide
      headerExtra={
        <button type="button" className="btn-pill" onClick={() => setCreating(true)}>
          + new project
        </button>
      }
    >
      <VaultStatusChip status={vaultStatus} error={vaultError} />

      {vaultStatus === "connected" && orphanedLocalProjects.length > 0 && (
        <div className="vault-migrate-banner">
          <span>
            {orphanedLocalProjects.length} project{orphanedLocalProjects.length > 1 ? "s" : ""} saved before the vault was connected.
          </span>
          <button type="button" className="btn-pill" disabled={migrating} onClick={migrateLocalProjectsToVault}>
            {migrating ? "migrating…" : "migrate to vault"}
          </button>
        </div>
      )}

      <div className="projects-toolbar">
        <button type="button" className={`btn-pill${!showArchived ? " btn-pill--active" : ""}`} onClick={() => setShowArchived(false)}>
          active
        </button>
        <button type="button" className={`btn-pill${showArchived ? " btn-pill--active" : ""}`} onClick={() => setShowArchived(true)}>
          archived
        </button>
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

      {creating && (
        <NewProjectModal
          onCreate={async (fields) => {
            const id = await createProject(fields);
            if (id) setOpenId(id);
          }}
          onClose={() => setCreating(false)}
        />
      )}
    </PageShell>
  );
}
