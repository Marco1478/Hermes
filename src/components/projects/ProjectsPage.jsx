import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useProjects, STATUSES, PRIORITIES } from "../../state/Projects.jsx";
import { useNotes } from "../../state/Notes.jsx";
import { PageShell } from "../PageShell.jsx";
import { VaultStatusChip } from "../VaultStatusChip.jsx";
import { ProjectWorkspace } from "./ProjectWorkspace.jsx";
import { plainTextPreview } from "../../lib/markdownLite.js";
import { parseTagsInput } from "../../lib/tags.js";
import { PROJECT_TEMPLATES } from "../../lib/projectTemplates.js";
import { writeVaultWorkflow, writeVaultCanvas } from "../../lib/obsidianBridge.js";
import { GlassButton } from "../ui/GlassButton.jsx";
import { GlassSegmented, GlassSegmentedOption } from "../ui/GlassSegmented.jsx";
import "./ProjectsPage.css";
// ProjectOverviewPanel/ProjectWorkflows/ProjectChatPanel reuse the Notes
// editor's textarea/checklist/tag-input/meta-select classes wholesale (by
// design, not by accident) — with pages code-split (CLAUDE-006), that
// reuse needs this page's own chunk to actually ship those rules, not just
// assume they're already on the page because Notes happened to load first.
import "../notes/NotesPage.css";

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

function NewProjectModal({ onCreate, onClose, vaultStatus }) {
  const [templateKey, setTemplateKey] = useState("generic");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("planning");
  const [color, setColor] = useState(null);
  const [tagsText, setTagsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const applyTemplate = (key) => {
    setTemplateKey(key);
    const t = PROJECT_TEMPLATES.find((tpl) => tpl.key === key);
    if (!t) return;
    setDescription(t.overview);
    setColor(t.color);
    setTagsText(t.tags.join(", "));
  };

  const onSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const tags = parseTagsInput(tagsText);
      const id = await onCreate({ name: name.trim(), description, status, color, tags });
      const template = PROJECT_TEMPLATES.find((t) => t.key === templateKey);
      // Best-effort scaffold: the project itself is already created and
      // usable even if these fail (e.g. vault not connected), so a
      // workflow/canvas write failure here never blocks project creation.
      if (id && vaultStatus === "connected" && template) {
        if (template.workflow) {
          try {
            await writeVaultWorkflow(id, null, template.workflow);
          } catch {
            /* starter workflow is a bonus, not required */
          }
        }
        if (template.canvas) {
          try {
            await writeVaultCanvas(id, null, { ...template.canvas, tags: [], edges: [] });
          } catch {
            /* starter canvas is a bonus, not required */
          }
        }
      }
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

        <p className="job-modal-label mono" style={{ marginBottom: "0.2rem" }}>
          Template
        </p>
        <div className="project-template-row">
          {PROJECT_TEMPLATES.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`btn-pill${templateKey === t.key ? " btn-pill--active" : ""}`}
              title={t.summary}
              onClick={() => applyTemplate(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {templateKey !== "generic" && (
          <p className="panel-empty" style={{ margin: 0 }}>
            {PROJECT_TEMPLATES.find((t) => t.key === templateKey)?.summary} Pre-fills description/color/tags below — all editable now and after creation.
            {PROJECT_TEMPLATES.find((t) => t.key === templateKey)?.workflow && " Adds a starter workflow once created."}
            {PROJECT_TEMPLATES.find((t) => t.key === templateKey)?.canvas && " Adds a starter canvas once created."}
          </p>
        )}

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
          <GlassButton variant="secondary" onClick={onClose} disabled={saving}>
            cancel
          </GlassButton>
          <GlassButton variant="primary" onClick={onSubmit} disabled={saving}>
            {saving ? "creating…" : "create"}
          </GlassButton>
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
    linkTask,
    unlinkTask,
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

  // Distinguishes *why* the grid is empty instead of one flat "no
  // projects" for every case — "0 active, 3 archived" and "0 total,
  // vault empty" and "5 exist but this filter hides them" are different
  // situations and read as contradictory/confusing if collapsed into
  // the same message (see instruction file 006, CLAUDE-004).
  const emptyMessage = useMemo(() => {
    if (filtered.length > 0) return null;
    const hasFilters = statusFilter !== "all" || Boolean(tagFilter) || query.trim().length > 0;
    if (statusCounts.all === 0) {
      const otherScopeCount = projects.filter((p) => Boolean(p.archived) !== showArchived).length;
      if (!showArchived && otherScopeCount > 0) {
        return `No active projects — ${otherScopeCount} archived. Switch to "archived" to see ${otherScopeCount === 1 ? "it" : "them"}.`;
      }
      if (showArchived) return "No archived projects.";
      return "No projects yet — create one above to get started.";
    }
    if (hasFilters) return "No projects match this filter.";
    return "No projects match.";
  }, [filtered.length, statusFilter, tagFilter, query, statusCounts.all, projects, showArchived]);

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
          taskActions={{
            link: (taskId) => linkTask(openProject.id, taskId),
            unlink: (taskId) => unlinkTask(openProject.id, taskId),
          }}
        />
      </PageShell>
    );
  }

  return (
    <PageShell title="Projects" wide>
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
        <GlassSegmented>
          <GlassSegmentedOption active={!showArchived} onClick={() => setShowArchived(false)}>
            active
          </GlassSegmentedOption>
          <GlassSegmentedOption active={showArchived} onClick={() => setShowArchived(true)}>
            archived
          </GlassSegmentedOption>
        </GlassSegmented>
        <input
          type="text"
          className="notes-search mono"
          placeholder={`Search ${statusCounts.all} ${showArchived ? "archived " : ""}project${statusCounts.all === 1 ? "" : "s"}…`}
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
        <button type="button" className="project-card project-card--add" onClick={() => setCreating(true)}>
          <span className="project-card-add-icon">+</span>
          <span className="project-card-add-label">new project</span>
        </button>
        {filtered.map((p) => (
          <ProjectCard key={p.id} project={p} onOpen={setOpenId} />
        ))}
        {emptyMessage && <p className="panel-empty">{emptyMessage}</p>}
      </div>

      {creating && (
        <NewProjectModal
          vaultStatus={vaultStatus}
          onCreate={async (fields) => {
            const id = await createProject(fields);
            if (id) setOpenId(id);
            return id;
          }}
          onClose={() => setCreating(false)}
        />
      )}
    </PageShell>
  );
}
