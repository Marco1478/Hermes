import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { STATUSES, PRIORITIES } from "../../state/Projects.jsx";

const STATUS_LABEL = { planning: "Planning", active: "Active", on_hold: "On hold", done: "Done" };

const COLORS = [
  { key: null, label: "none" },
  { key: "teal", label: "teal" },
  { key: "warn", label: "amber" },
  { key: "bad", label: "coral" },
  { key: "ok", label: "green" },
  { key: "violet", label: "violet" },
];

function progressOf(project) {
  if (!project.milestones.length) return null;
  return project.milestones.filter((m) => m.done).length / project.milestones.length;
}

/*
  ProjectOverviewPanel — name/status/priority/due/color/tags/description +
  milestones checklist. Linked notes moved to its own workspace tab
  (ProjectNotesPanel); this panel is the project's own facts, not its
  relations to other objects.
*/
export function ProjectOverviewPanel({ project, vaultStatus, onUpdate, onDelete, onToggleArchive, onAddMilestone, onToggleMilestone, onRemoveMilestone }) {
  const [newMilestone, setNewMilestone] = useState("");
  const [newTag, setNewTag] = useState("");
  const progress = progressOf(project);

  const addTag = () => {
    const t = newTag.trim();
    if (!t) return;
    if (!project.tags.includes(t)) onUpdate({ tags: [...project.tags, t] });
    setNewTag("");
  };

  return (
    <div className="project-overview-panel">
      <div className="notes-editor-top">
        <input className="notes-title-input" value={project.name} onChange={(e) => onUpdate({ name: e.target.value })} placeholder="Untitled project" />
        <div className="notes-editor-actions">
          <button type="button" className="btn-pill" onClick={onToggleArchive}>
            {project.archived ? "unarchive" : "archive"}
          </button>
          {vaultStatus !== "connected" && (
            <button
              type="button"
              className="btn-pill btn-pill--danger"
              onClick={() => {
                if (window.confirm("Delete this project? Linked notes are kept, just unlinked.")) onDelete();
              }}
            >
              delete project
            </button>
          )}
        </div>
      </div>

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
          <input className="notes-checklist-input mono" value={newMilestone} onChange={(e) => setNewMilestone(e.target.value)} placeholder="+ milestone…" />
        </form>
      </div>
    </div>
  );
}
