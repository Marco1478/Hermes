import { motion } from "framer-motion";

/*
  KanbanCard — one task tile on the mission board. Only ever shows fields
  the CLI actually returned (assignee, branch_name, priority, timestamps) —
  no invented "verification state" or fake progress, per the spec's ban on
  faking backend-shaped data that doesn't exist yet.
*/
function relTimeAgo(sec) {
  if (!sec) return "—";
  const s = Math.round(Date.now() / 1000 - sec);
  if (s < 60) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function KanbanCard({ task, onOpen, project }) {
  const lastEventAt = task.completed_at || task.started_at || task.created_at;
  return (
    <motion.button
      type="button"
      className={`glass-card glass-card--interactive kanban-card${project ? ` kanban-card--project kanban-card--project-${project.color || "teal"}` : ""}`}
      onClick={() => onOpen(task.id)}
      layout
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4, transition: { duration: 0.15 } }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
    >
      <div className="kanban-card-head">
        <span className="kanban-card-id mono">{task.id}</span>
        {task.priority > 0 && <span className="tag-badge">P{task.priority}</span>}
      </div>
      {project && <span className="tag-badge kanban-card-project-chip">◆ {project.name}</span>}
      <p className="kanban-card-title">{task.title}</p>
      <div className="kanban-card-meta mono">
        <span className="kanban-card-owner">{task.assignee || "unassigned"}</span>
        <span>{relTimeAgo(lastEventAt)}</span>
      </div>
      {task.branch_name && <span className="kanban-card-branch mono">⎇ {task.branch_name}</span>}
      {task.status === "blocked" && task.block_reason && <p className="kanban-card-blocked">{task.block_reason}</p>}
    </motion.button>
  );
}
