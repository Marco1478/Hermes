import { useEffect, useState } from "react";
import { useChat } from "../../state/Chat.jsx";
import { useViewMode } from "../../state/ViewMode.jsx";
import { fetchVaultCanvases, fetchVaultWorkflows } from "../../lib/obsidianBridge.js";
import { fetchKanbanTask } from "../../lib/kanbanBridge.js";

function buildContextMessage(project, linkedNotes, canvases, workflows, tasks) {
  const activeWorkflows = workflows.filter((w) => w.status === "active");
  const blockedSteps = workflows.reduce((sum, w) => sum + (w.steps || []).filter((s) => s.status === "blocked").length, 0);
  const openTasks = tasks.filter((t) => t.status !== "done");
  const blockedTasks = tasks.filter((t) => t.status === "blocked");
  const lines = [
    "Project context loaded:",
    `- Project: ${project.name || "Untitled project"}`,
    `- Obsidian folder: Hermes/Projects/${project.name}`,
    `- Overview: Hermes/Projects/${project.name}/overview.md`,
    `- Status: ${project.status} · priority: ${project.priority}`,
    `- Notes: ${linkedNotes.length} linked note${linkedNotes.length === 1 ? "" : "s"}`,
    `- Canvases: ${canvases.length}`,
    `- Workflows: ${activeWorkflows.length} active (${workflows.length} total)${blockedSteps ? `, ${blockedSteps} blocked step${blockedSteps === 1 ? "" : "s"}` : ""}`,
    `- Kanban: ${tasks.length} linked task${tasks.length === 1 ? "" : "s"} (${openTasks.length} open, ${blockedTasks.length} blocked)`,
  ];
  if (project.tags?.length) lines.push(`- Tags: ${project.tags.join(", ")}`);
  if (project.description) lines.push("", project.description);
  lines.push("", "When answering, use this project as the active context.");
  return lines.join("\n");
}

/*
  ProjectChatPanel — seeds a new chat with a real, visible context message
  instead of silently attaching invisible context: no session/context API
  exists on the real backend to attach this server-side, so the message is
  put directly in the composer for Marco to see (and edit) before it's
  actually sent as the first real turn. Kanban counts come from the same
  linkedKanbanIds relation ProjectKanbanPanel/ProjectIntelligencePanel use
  (task fetch failures — e.g. an archived/deleted task — are dropped from
  the count rather than guessed at).
*/
export function ProjectChatPanel({ project, notes }) {
  const { newChat, setDraft } = useChat();
  const { goTo } = useViewMode();
  const [canvases, setCanvases] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    fetchVaultCanvases(project.id)
      .then((res) => setCanvases(res.data || []))
      .catch(() => setCanvases([]));
    fetchVaultWorkflows(project.id)
      .then((res) => setWorkflows(res.data || []))
      .catch(() => setWorkflows([]));
    Promise.all(
      (project.linkedKanbanIds || []).map((id) =>
        fetchKanbanTask(id)
          .then((res) => res.data.task)
          .catch(() => null)
      )
    ).then((results) => setTasks(results.filter(Boolean)));
  }, [project.id, project.linkedKanbanIds]);

  const linkedNotes = project.linkedNoteIds.map((id) => notes.find((n) => n.id === id)).filter(Boolean);

  const onStart = () => {
    const message = buildContextMessage(project, linkedNotes, canvases, workflows, tasks);
    newChat();
    setDraft(message);
    goTo("chat");
  };

  return (
    <div className="panel-section">
      <p className="panel-section-title">Chat</p>
      <p className="panel-empty">
        Starts a new chat with this project's context pre-filled in the composer — nothing is sent until you review it and hit Send.
      </p>
      <button type="button" className="btn-pill" onClick={onStart}>
        Start Hermes chat for this project
      </button>
      <div className="notes-editor-meta" style={{ marginTop: "0.5rem" }}>
        <span className="mono panel-empty">
          {linkedNotes.length} notes · {canvases.length} canvases · {workflows.length} workflows · {tasks.length} tasks
        </span>
      </div>
    </div>
  );
}
