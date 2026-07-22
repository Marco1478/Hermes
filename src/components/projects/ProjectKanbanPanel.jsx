import { useCallback, useEffect, useState } from "react";
import { useViewMode } from "../../state/ViewMode.jsx";
import { fetchKanbanTask, createKanbanTask } from "../../lib/kanbanBridge.js";

const STATUS_TONE = { done: "ok", blocked: "bad", running: "info" };

/*
  ProjectKanbanPanel — the main Kanban board stays the one real board (see
  KanbanPage.jsx's projectByTaskId); this is a filtered view of exactly the
  tasks this project has linked, backed by the same real
  fetchKanbanTask/createKanbanTask calls, not a separate local board.
*/
export function ProjectKanbanPanel({ project, onLinkTask, onUnlinkTask }) {
  const { goTo } = useViewMode();
  const [tasks, setTasks] = useState({}); // id -> task | {error}
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [linkId, setLinkId] = useState("");
  const [error, setError] = useState(null);

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

  const list = Object.entries(tasks);

  return (
    <div className="panel-section">
      <div className="project-section-head">
        <p className="panel-section-title" style={{ marginBottom: 0 }}>
          Kanban ({list.length})
        </p>
        <button type="button" className="btn-pill" onClick={() => goTo("kanban")}>
          open main board →
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

      {loading && <p className="panel-empty">Loading…</p>}
      {!loading && list.length === 0 && <p className="panel-empty">No Kanban tasks linked yet. Created/linked tasks also show on the main board.</p>}
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
              <button type="button" className="btn-pill" onClick={() => onUnlinkTask(id)}>
                unlink
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
