import { useState } from "react";
import { useProjects } from "../../state/Projects.jsx";
import { projectColorVar } from "../../lib/projectColor.js";

/*
  KanbanProjectAssign — lets a task be assigned to / removed from a project
  straight from the Main Kanban drawer, using the same real relation every
  other project<->task link uses (project.linkedKanbanIds, via
  useProjects().linkTask/unlinkTask — see state/Projects.jsx). No new
  storage invented: this is the same link ProjectKanbanPanel creates from
  the project side, just reachable from the task side too. Removing the
  assignment doesn't delete or move the task anywhere — it just drops the
  relation, which is exactly what returns it to General/Inbox on the board.
*/
export function KanbanProjectAssign({ task, project }) {
  const { projects, linkTask, unlinkTask } = useProjects();
  const [selected, setSelected] = useState("");
  const assignable = projects.filter((p) => !p.archived);

  return (
    <div className="panel-section kanban-actions">
      <p className="panel-section-title">Project</p>
      {project ? (
        <div className="kanban-action-row">
          <span className="tag-badge kanban-card-project-chip" style={{ color: projectColorVar(project.color) }}>
            ◆ {project.name || "Untitled project"}
          </span>
          <button type="button" className="btn-pill" onClick={() => unlinkTask(project.id, task.id)}>
            move to General/Inbox
          </button>
        </div>
      ) : (
        <div className="kanban-action-row">
          <select className="kanban-action-input" value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">assign to project…</option>
            {assignable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || "Untitled project"}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-pill"
            disabled={!selected}
            onClick={() => {
              linkTask(selected, task.id, task.title);
              setSelected("");
            }}
          >
            assign
          </button>
        </div>
      )}
    </div>
  );
}
