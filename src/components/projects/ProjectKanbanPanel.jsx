import { useCallback, useEffect, useState } from "react";
import { useViewMode } from "../../state/ViewMode.jsx";
import { fetchKanbanTask, createKanbanTask, promoteKanbanTask, blockKanbanTask, unblockKanbanTasks, completeKanbanTasks } from "../../lib/kanbanBridge.js";
import { logProjectActivity } from "../../lib/obsidianBridge.js";

const STATUS_TONE = { done: "ok", blocked: "bad", running: "info" };

// Same real transitions the main board's drag-and-drop offers (see
// KanbanPage.jsx's DROP_ACTIONS) — "running"/"review" are worker-set
// states with no direct human command to force them, so this only ever
// offers the moves the CLI actually supports for the state a task is in,
// same canned-reason idiom the board's drag-drop already uses (no prompt
// dialog anywhere else in this app for a one-line reason).
function actionsFor(status) {
  const actions = [];
  if (status === "triage" || status === "todo") actions.push({ key: "promote", label: "→ ready", run: (id) => promoteKanbanTask(id, "Promoted from project Kanban") });
  if (status === "ready" || status === "running" || status === "review") actions.push({ key: "complete", label: "✓ complete", run: (id) => completeKanbanTasks([id], "Completed from project Kanban") });
  if (status !== "blocked" && status !== "scheduled" && status !== "done") actions.push({ key: "block", label: "block", run: (id) => blockKanbanTask(id, "Blocked from project Kanban") });
  if (status === "blocked" || status === "scheduled") actions.push({ key: "unblock", label: "unblock", run: (id) => unblockKanbanTasks([id]) });
  return actions;
}

/*
  ProjectKanbanPanel — the main Kanban board stays the one real board (see
  KanbanPage.jsx's projectByTaskId); this is a filtered view of exactly the
  tasks this project has linked, backed by the same real
  fetchKanbanTask/createKanbanTask calls, not a separate local board.
*/
export function ProjectKanbanPanel({ project, onLinkTask, onUnlinkTask }) {
  const { goToKanban } = useViewMode();
  const [tasks, setTasks] = useState({}); // id -> task | {error}
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [linkId, setLinkId] = useState("");
  const [error, setError] = useState(null);
  const [actionBusyId, setActionBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const entries = await Promise.all(
      (project.linkedKanbanIds || []).map(async (id) => {
        try {
          const res = await fetchKanbanTask(id);
          return [id, res.data.task];
        } catch (err) {
          return [id, { error: err.message || String(err) }];
        }
      })
    );
    setTasks(Object.fromEntries(entries));
    setLoading(false);
  }, [project.linkedKanbanIds]);

  useEffect(() => {
    load();
  }, [load]);

  const onCreate = async () => {
    if (!newTitle.trim()) return;
    setError(null);
    try {
      const res = await createKanbanTask({ title: newTitle.trim(), triage: false });
      const newId = res.data?.id || res.data?.task?.id;
      if (newId) {
        onLinkTask(newId);
        setNewTitle("");
        await load();
      }
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  const onLinkExisting = async () => {
    const id = linkId.trim();
    if (!id) return;
    setError(null);
    try {
      await fetchKanbanTask(id); // verify it exists before linking
      onLinkTask(id);
      setLinkId("");
      await load();
    } catch (err) {
      setError(`Task ${id} not found: ${err.message || String(err)}`);
    }
  };

  // Only "complete"/"block" get an activity line (CLAUDE-006 of Instructions
  // 010) — "promote"/"unblock" are intermediate state moves, not the
  // milestone-level events the timeline is meant to stay limited to.
  const runAction = async (id, action, task) => {
    setActionBusyId(id);
    setActionError(null);
    try {
      await action.run(id);
      if (action.key === "complete") logProjectActivity(project.id, "kanban", `Task completed: "${task.title}"`);
      else if (action.key === "block") logProjectActivity(project.id, "kanban", `Task blocked: "${task.title}"`);
      await load();
    } catch (err) {
      setActionError(err.message || String(err));
    } finally {
      setActionBusyId(null);
    }
  };

  const list = Object.entries(tasks);

  return (
    <div className="panel-section">
      <div className="project-section-head">
        <p className="panel-section-title project-kanban-title" style={{ marginBottom: 0 }}>
          {project.color && <span className={`note-color-dot note-color-dot--${project.color}`} />}
          Kanban ({list.length})
          {project.tags.length > 0 && (
            <span className="project-kanban-tags">
              {project.tags.map((t) => (
                <span key={t} className="tag-badge">
                  #{t}
                </span>
              ))}
            </span>
          )}
        </p>
        <button type="button" className="btn-pill" onClick={() => goToKanban(project.id)}>
          open in main board →
        </button>
      </div>

      <div className="kanban-action-row">
        <input className="kanban-action-input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="New task title…" onKeyDown={(e) => e.key === "Enter" && onCreate()} />
        <button type="button" className="btn-pill" onClick={onCreate}>
          + create task
        </button>
      </div>
      <div className="kanban-action-row">
        <input className="kanban-action-input mono" value={linkId} onChange={(e) => setLinkId(e.target.value)} placeholder="t_xxxxxxxx" onKeyDown={(e) => e.key === "Enter" && onLinkExisting()} />
        <button type="button" className="btn-pill" onClick={onLinkExisting}>
          + link existing task
        </button>
      </div>
      {error && <p className="panel-error">{error}</p>}
      {actionError && <p className="panel-error">{actionError}</p>}

      {loading && <p className="panel-empty">Loading…</p>}
      {!loading && list.length === 0 && (
        <p className="panel-empty">
          No Kanban tasks linked to {project.name || "this project"} yet. Created/linked tasks also show on the main
          board with this project's chip.
        </p>
      )}
      <div className="canvas-list">
        {list.map(([id, task]) =>
          task.error ? (
            <div key={id} className="canvas-list-item">
              <span className="panel-error mono">
                {id}: {task.error}
              </span>
              <button type="button" className="btn-pill" onClick={() => onUnlinkTask(id)}>
                unlink
              </button>
            </div>
          ) : (
            <div key={id} className="canvas-list-item">
              <span className="canvas-list-name">
                <span className={`status-badge status-badge--${STATUS_TONE[task.status] || ""}`}>{task.status}</span> {task.title}
              </span>
              <div className="project-kanban-row-actions">
                {actionsFor(task.status).map((a) => (
                  <button key={a.key} type="button" className="btn-pill" disabled={actionBusyId === id} onClick={() => runAction(id, a, task)}>
                    {a.label}
                  </button>
                ))}
                <button type="button" className="btn-pill" onClick={() => onUnlinkTask(id)}>
                  unlink
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
