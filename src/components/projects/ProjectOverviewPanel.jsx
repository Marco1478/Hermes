import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { STATUSES, PRIORITIES } from "../../state/Projects.jsx";
import { normalizeTag } from "../../lib/tags.js";
import { useProjectSignals } from "../../lib/useProjectSignals.js";

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

function relTimeAgo(ms) {
  if (!ms) return "—";
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function Tile({ label, value, sub, tone, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} className={`overview-tile${tone ? ` overview-tile--${tone}` : ""}`} onClick={onClick}>
      <span className="overview-tile-label mono">{label}</span>
      <span className="overview-tile-value">{value}</span>
      {sub && <span className="overview-tile-sub mono">{sub}</span>}
    </Tag>
  );
}

/*
  ProjectOverviewPanel — the project's Home (CLAUDE-003 of Instructions
  009): identity facts (name/status/priority/due/color/tags — unchanged
  from before) PLUS a real dashboard merged in from what used to be a
  separate, easy-to-miss "Intelligence" tab — state tiles, latest changes,
  open blockers, and a deterministic suggested next action, all built from
  the same useProjectSignals hook ProjectChatPanel/ProjectIntelligencePanel
  already shared. No LLM-generated summary anywhere here — every number
  traces to a real fetched value, same rule as before.
*/
export function ProjectOverviewPanel({ project, notes, vaultStatus, onNavigate, onUpdate, onDelete, onToggleArchive, onAddMilestone, onToggleMilestone, onRemoveMilestone }) {
  const [newMilestone, setNewMilestone] = useState("");
  const [newTag, setNewTag] = useState("");
  const progress = progressOf(project);

  const { canvases, workflows, tasks, assets, loading, error: loadError } = useProjectSignals(project);
  const linkedNotes = useMemo(() => project.linkedNoteIds.map((id) => notes.find((n) => n.id === id)).filter((n) => n && !n.archived), [project.linkedNoteIds, notes]);
  const recentNotes = useMemo(() => [...linkedNotes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3), [linkedNotes]);

  const activeWorkflows = workflows.filter((w) => w.status !== "done");
  const openTasks = tasks.filter((t) => t.status !== "done");
  const blockedTasks = tasks.filter((t) => t.status === "blocked");
  const blockedStepEntries = workflows.flatMap((w) => (w.steps || []).filter((s) => s.status === "blocked").map((s) => ({ step: s, workflow: w })));
  const totalBlocked = blockedTasks.length + blockedStepEntries.length;
  const nothingLinkedAtAll = linkedNotes.length === 0 && canvases.length === 0 && workflows.length === 0 && tasks.length === 0 && assets.length === 0;

  const nextAction = loading
    ? null
    : totalBlocked > 0
      ? `${totalBlocked} blocked item${totalBlocked === 1 ? "" : "s"} — clear ${blockedTasks.length > 0 ? "the Kanban tab" : "the Workflows tab"} first.`
      : nothingLinkedAtAll
        ? "Nothing linked yet — add a note, canvas, workflow, or task to get this project moving."
        : openTasks.length > 0
          ? `${openTasks.length} open Kanban task${openTasks.length === 1 ? "" : "s"} — check the Kanban tab.`
          : "Nothing obviously blocking right now.";

  const addTag = () => {
    const t = normalizeTag(newTag);
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

      <p className="project-home-timestamps mono panel-empty">
        created {new Date(project.createdAt).toLocaleDateString()} · updated {relTimeAgo(project.updatedAt)}
      </p>

      {loadError && <p className="panel-error">Couldn't load full project state: {loadError}</p>}

      {nothingLinkedAtAll && !loading ? (
        <div className="project-home-empty panel-section">
          <p className="panel-section-title" style={{ marginBottom: "0.3rem" }}>
            Get this project moving
          </p>
          <p className="panel-empty" style={{ margin: 0 }}>
            Nothing linked yet — start with whichever fits: a note to capture context, a canvas to sketch it out, or a
            workflow to plan the steps.
          </p>
          <div className="job-modal-actions" style={{ marginTop: "0.5rem" }}>
            <button type="button" className="btn-pill" onClick={() => onNavigate("notes")}>
              + note
            </button>
            <button type="button" className="btn-pill" onClick={() => onNavigate("canvas")}>
              + canvas
            </button>
            <button type="button" className="btn-pill" onClick={() => onNavigate("workflows")}>
              + workflow
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="panel-section">
            <p className="panel-section-title" style={{ marginBottom: "0.3rem" }}>
              Current state
            </p>
            {loading ? (
              <p className="panel-empty" style={{ margin: 0 }}>
                Loading…
              </p>
            ) : (
              <div className="overview-tile-grid">
                <Tile label="NOTES" value={linkedNotes.length} onClick={() => onNavigate("notes")} />
                <Tile label="CANVASES" value={canvases.length} onClick={() => onNavigate("canvas")} />
                <Tile label="WORKFLOWS" value={activeWorkflows.length} sub={`${workflows.length} total`} onClick={() => onNavigate("workflows")} />
                <Tile label="KANBAN TASKS" value={openTasks.length} sub={`${tasks.length} linked`} onClick={() => onNavigate("kanban")} />
                <Tile label="ASSETS" value={assets.length} onClick={() => onNavigate("canvas")} />
                <Tile label="BLOCKED" value={totalBlocked} tone={totalBlocked > 0 ? "bad" : "ok"} sub={`${blockedTasks.length} task, ${blockedStepEntries.length} step`} />
              </div>
            )}
          </div>

          <div className="panel-section">
            <p className="panel-section-title" style={{ marginBottom: "0.3rem" }}>
              Latest changes
            </p>
            {recentNotes.length > 0 ? (
              <div className="project-home-recent-list">
                {recentNotes.map((n) => (
                  <button key={n.id} type="button" className="project-home-recent-row" onClick={() => onNavigate("notes")}>
                    <span className="project-home-recent-title">{n.title || "Untitled"}</span>
                    <span className="project-home-recent-time mono">{relTimeAgo(n.updatedAt)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="panel-empty" style={{ margin: 0 }}>
                No linked notes yet.
              </p>
            )}
            <p className="panel-empty project-home-hint" style={{ margin: 0 }}>
              Canvases/workflows/assets don't carry a modification timestamp in this build, so only notes show here.
            </p>
          </div>

          {totalBlocked > 0 && (
            <div className="panel-section">
              <p className="panel-section-title" style={{ marginBottom: "0.3rem" }}>
                Open blockers
              </p>
              <div className="project-home-recent-list">
                {blockedTasks.map((t) => (
                  <button key={t.id} type="button" className="project-home-recent-row" onClick={() => onNavigate("kanban")}>
                    <span className="status-badge status-badge--bad">blocked</span>
                    <span className="project-home-recent-title">{t.title}</span>
                  </button>
                ))}
                {blockedStepEntries.map(({ step, workflow }) => (
                  <button key={step.id} type="button" className="project-home-recent-row" onClick={() => onNavigate("workflows")}>
                    <span className="status-badge status-badge--bad">blocked</span>
                    <span className="project-home-recent-title">
                      {step.title || "Untitled step"} <span className="project-home-recent-time mono">({workflow.name})</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="panel-section">
            <p className="panel-section-title" style={{ marginBottom: "0.3rem" }}>
              Suggested next action
            </p>
            <p className="panel-empty" style={{ margin: 0 }}>
              {nextAction}
            </p>
          </div>
        </>
      )}

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
