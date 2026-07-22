import { useEffect, useState } from "react";
import { useChat } from "../../state/Chat.jsx";
import { useViewMode } from "../../state/ViewMode.jsx";
import { fetchVaultCanvases, fetchVaultWorkflows } from "../../lib/obsidianBridge.js";

function buildContextMessage(project, linkedNotes, canvases, workflows) {
  const activeWorkflows = workflows.filter((w) => w.status === "active");
  const lines = [
    "Project context loaded:",
    `- Project: ${project.name || "Untitled project"}`,
    `- Obsidian folder: Hermes/Projects/${project.name}`,
    `- Overview: Hermes/Projects/${project.name}/overview.md`,
    `- Status: ${project.status} · priority: ${project.priority}`,
    `- Notes: ${linkedNotes.length} linked note${linkedNotes.length === 1 ? "" : "s"}`,
    `- Canvases: ${canvases.length}`,
    `- Workflows: ${activeWorkflows.length} active (${workflows.length} total)`,
  ];
  if (project.tags?.length) lines.push(`- Tags: ${project.tags.join(", ")}`);
  if (project.description) lines.push("", project.description);
  lines.push(
    "",
    "Kanban: not linked yet in this UI build — per-project task filtering lands in a later chunk (see docs/claude status reports), so this context does not claim a task count.",
    "",
    "When answering, use this project as the active context."
  );
  return lines.join("\n");
}

/*
  ProjectChatPanel — seeds a new chat with a real, visible context message
  instead of silently attaching invisible context: no session/context API
  exists on the real backend to attach this server-side, so the message is
  put directly in the composer for Marco to see (and edit) before it's
  actually sent as the first real turn.
*/
export function ProjectChatPanel({ project, notes }) {
  const { newChat, setDraft } = useChat();
  const { goTo } = useViewMode();
  const [canvases, setCanvases] = useState([]);
  const [workflows, setWorkflows] = useState([]);

  useEffect(() => {
    fetchVaultCanvases(project.id)
      .then((res) => setCanvases(res.data || []))
      .catch(() => setCanvases([]));
    fetchVaultWorkflows(project.id)
      .then((res) => setWorkflows(res.data || []))
      .catch(() => setWorkflows([]));
  }, [project.id]);

  const linkedNotes = project.linkedNoteIds.map((id) => notes.find((n) => n.id === id)).filter(Boolean);

  const onStart = () => {
    const message = buildContextMessage(project, linkedNotes, canvases, workflows);
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
          {linkedNotes.length} notes · {canvases.length} canvases · {workflows.length} workflows
        </span>
      </div>
    </div>
  );
}
