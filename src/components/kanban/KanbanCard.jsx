import { useRef, useState } from "react";
import { motion, useMotionValue } from "framer-motion";
import { projectColorVar } from "../../lib/projectColor.js";

/*
  KanbanCard — one task tile on the mission board. Only ever shows fields
  the CLI actually returned (assignee, branch_name, priority, timestamps) —
  no invented "verification state" or fake progress, per the spec's ban on
  faking backend-shaped data that doesn't exist yet.

  Dragging is hand-rolled pointer tracking, not framer's `drag` prop or
  Reorder (both are single-list — this needs to detect which of several
  SEPARATE column containers the pointer ends up over). A small movement
  threshold before treating the gesture as a drag (rather than a click)
  keeps opening the task drawer working normally — see onPointerDown.
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

const DRAG_THRESHOLD = 6;

export function KanbanCard({ task, onOpen, project, onDragChange, onDrop }) {
  const lastEventAt = task.completed_at || task.started_at || task.created_at;
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const movedRef = useRef(false);
  const elRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  // elementFromPoint hit-tests whatever's actually painted at that point —
  // since this card is visually translated to follow the cursor, without
  // this it just finds ITSELF (or a child) under the pointer, never the
  // column underneath. Hiding it from hit-testing for the single frame of
  // the lookup is the standard fix.
  const columnUnder = (clientX, clientY) => {
    const el = elRef.current;
    const prev = el.style.pointerEvents;
    el.style.pointerEvents = "none";
    const under = document.elementFromPoint(clientX, clientY);
    el.style.pointerEvents = prev;
    return under?.closest("[data-column]")?.dataset.column || null;
  };

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    movedRef.current = false;

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!movedRef.current && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        movedRef.current = true;
        setDragging(true);
      }
      if (movedRef.current) {
        x.set(dx);
        y.set(dy);
        onDragChange(task.id, columnUnder(ev.clientX, ev.clientY));
      }
    };
    const onUp = (ev) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (movedRef.current) {
        onDrop(task, columnUnder(ev.clientX, ev.clientY));
      }
      setDragging(false);
      onDragChange(null, null);
      x.set(0);
      y.set(0);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <motion.button
      ref={elRef}
      type="button"
      className={`glass-card glass-card--interactive kanban-card${project ? ` kanban-card--project kanban-card--project-${project.color || "teal"}` : ""}${dragging ? " kanban-card--dragging" : ""}`}
      onPointerDown={onPointerDown}
      onClick={(e) => {
        if (movedRef.current) {
          e.preventDefault();
          return;
        }
        onOpen(task.id);
      }}
      style={{ x, y }}
      layout={!dragging}
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={dragging ? undefined : { y: -4, transition: { duration: 0.15 } }}
      whileTap={dragging ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
    >
      <div className="kanban-card-head">
        <span className="kanban-card-id mono">{task.id}</span>
        {task.priority > 0 && <span className="tag-badge">P{task.priority}</span>}
      </div>
      {project ? (
        <span className="tag-badge kanban-card-project-chip" style={{ color: projectColorVar(project.color) }}>
          ◆ {project.name}
        </span>
      ) : (
        <span className="tag-badge kanban-card-general-chip">○ General</span>
      )}
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
