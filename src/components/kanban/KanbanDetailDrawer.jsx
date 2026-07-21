import { motion } from "framer-motion";

function fmtTs(sec) {
  if (!sec) return "—";
  return new Date(sec * 1000).toLocaleString();
}

function EventRow({ event }) {
  return (
    <div className="kanban-event-row">
      <span className="kanban-event-kind mono">{event.kind}</span>
      <span className="kanban-event-time mono">{fmtTs(event.created_at)}</span>
    </div>
  );
}

/*
  KanbanDetailDrawer — full task detail: description, comments, event log,
  linked branch, and (wired in CLAUDE-004) the write actions. Read-only
  here; `actions` prop is optional so this same drawer works before and
  after that chunk lands.
*/
export function KanbanDetailDrawer({ detail, loading, error, onClose, actions }) {
  return (
    <motion.div
      className="kanban-drawer-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="glass-card kanban-drawer"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 24 }}
        transition={{ duration: 0.18 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Task detail"
      >
        <button type="button" className="btn-pill kanban-drawer-close" onClick={onClose}>
          close
        </button>

        {loading && <p className="panel-empty">Loading…</p>}
        {error && <p className="panel-error">{error}</p>}

        {detail && (
          <>
            <div className="kanban-drawer-head">
              <span className="mono kanban-drawer-id">{detail.task.id}</span>
              <span className={`status-badge status-badge--${statusTone(detail.task.status)}`}>{detail.task.status}</span>
            </div>
            <h2 className="kanban-drawer-title">{detail.task.title}</h2>
            {detail.task.body && <p className="kanban-drawer-body">{detail.task.body}</p>}

            <div className="kanban-drawer-facts mono">
              <span>owner: {detail.task.assignee || "unassigned"}</span>
              <span>priority: {detail.task.priority}</span>
              {detail.task.branch_name && <span>branch: {detail.task.branch_name}</span>}
              {detail.task.project_id && <span>project: {detail.task.project_id}</span>}
              <span>created: {fmtTs(detail.task.created_at)}</span>
              {detail.task.completed_at && <span>completed: {fmtTs(detail.task.completed_at)}</span>}
            </div>

            {detail.latest_summary && (
              <div className="panel-section">
                <p className="panel-section-title">Result</p>
                <p className="kanban-drawer-body">{detail.latest_summary}</p>
              </div>
            )}

            {actions}

            <div className="panel-section">
              <p className="panel-section-title">Comments</p>
              {detail.comments.length === 0 && <p className="panel-empty">No comments.</p>}
              {detail.comments.map((c, i) => (
                <div key={i} className="kanban-comment">
                  <span className="kanban-comment-author mono">{c.author}</span>
                  <p className="kanban-comment-body">{c.body}</p>
                </div>
              ))}
            </div>

            <div className="panel-section">
              <p className="panel-section-title">Event log</p>
              {detail.events.map((e, i) => (
                <EventRow key={i} event={e} />
              ))}
            </div>

            {(detail.parents.length > 0 || detail.children.length > 0) && (
              <div className="panel-section">
                <p className="panel-section-title">Links</p>
                {detail.parents.length > 0 && <p className="kanban-drawer-facts mono">parents: {detail.parents.join(", ")}</p>}
                {detail.children.length > 0 && <p className="kanban-drawer-facts mono">children: {detail.children.join(", ")}</p>}
              </div>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function statusTone(status) {
  if (status === "done") return "ok";
  if (status === "blocked") return "bad";
  if (status === "running") return "info";
  return "";
}
