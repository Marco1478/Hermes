import { useChat } from "../../state/Chat.jsx";
import { useViewMode } from "../../state/ViewMode.jsx";
import { useProjectSignals } from "../../lib/useProjectSignals.js";
import { buildProjectContextMessage } from "../../lib/projectContext.js";
import { GlassButton } from "../ui/GlassButton.jsx";

/*
  ProjectChatPanel — seeds a new chat with a real, visible context message
  instead of silently attaching invisible context: no session/context API
  exists on the real backend to attach this server-side, so the message is
  put directly in the composer for Marco to see (and edit) before it's
  actually sent as the first real turn. Same builder (src/lib/
  projectContext.js) and data (src/lib/useProjectSignals.js) as
  ProjectIntelligencePanel's "Analyze in Chat" — one context message, two
  entry points into it.
*/
export function ProjectChatPanel({ project, notes }) {
  const { newChat, setDraft } = useChat();
  const { goTo } = useViewMode();
  const { canvases, workflows, tasks, assets, loading } = useProjectSignals(project);

  const linkedNotes = project.linkedNoteIds.map((id) => notes.find((n) => n.id === id)).filter(Boolean);

  const onStart = () => {
    const message = buildProjectContextMessage(project, linkedNotes, canvases, workflows, tasks, assets);
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
      <GlassButton variant="primary" onClick={onStart} disabled={loading}>
        Start Hermes chat for this project
      </GlassButton>
      <div className="notes-editor-meta" style={{ marginTop: "0.5rem" }}>
        <span className="mono panel-empty">
          {linkedNotes.length} notes · {canvases.length} canvases · {workflows.length} workflows · {tasks.length} tasks · {assets.length} assets
        </span>
      </div>
    </div>
  );
}
