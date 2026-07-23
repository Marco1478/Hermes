import { useMemo } from "react";
import { useChat } from "../../state/Chat.jsx";
import { useViewMode } from "../../state/ViewMode.jsx";
import { useProjectSignals } from "../../lib/useProjectSignals.js";
import { buildProjectContextMessage } from "../../lib/projectContext.js";
import { GlassButton } from "../ui/GlassButton.jsx";

/*
  ProjectIntelligencePanel — the state SUMMARY (tiles/blockers/suggested
  next action) moved to ProjectOverviewPanel as the real Home dashboard
  (CLAUDE-003 of Instructions 009); showing the same counts on two tabs was
  itself a coherence problem the audit flagged. What's left here is
  deliberately just the bridge into Hermes: no /local route for
  Hermes-generated project analysis exists on this backend (grepped
  vite-plugins/), so "Analyze in Chat" seeds the exact same real context
  message ProjectChatPanel's own button does (shared builder in
  src/lib/projectContext.js) rather than faking a summary.
*/
export function ProjectIntelligencePanel({ project, notes, onOpenChat }) {
  const { newChat, setDraft } = useChat();
  const { goTo } = useViewMode();
  const { canvases, workflows, tasks, assets, loading } = useProjectSignals(project);

  const linkedNotes = useMemo(() => project.linkedNoteIds.map((id) => notes.find((n) => n.id === id)).filter((n) => n && !n.archived), [project.linkedNoteIds, notes]);

  const onAnalyzeInChat = () => {
    const message = buildProjectContextMessage(project, linkedNotes, canvases, workflows, tasks, assets);
    newChat();
    setDraft(message);
    goTo("chat");
  };

  return (
    <div className="panel-section">
      <p className="panel-section-title">Intelligence</p>

      <div className="panel-section">
        <p className="panel-section-title" style={{ marginBottom: "0.3rem" }}>
          What this is
        </p>
        <p className="panel-empty" style={{ margin: 0 }}>
          {project.description?.trim() || "No description yet — add one from the Home tab."}
        </p>
      </div>

      <p className="panel-section-title" style={{ marginTop: "0.9rem", marginBottom: "0.3rem" }}>
        Ask Hermes
      </p>
      <p className="panel-empty" style={{ margin: 0 }}>
        No Hermes analysis endpoint exists on this build yet — nothing below is model-generated. This seeds the project's real
        notes/canvases/workflows/tasks/assets into a new chat message for you to review and send.
      </p>
      <div className="job-modal-actions" style={{ marginTop: "0.5rem" }}>
        <GlassButton variant="primary" onClick={onAnalyzeInChat} disabled={loading}>
          Analyze in Chat →
        </GlassButton>
        <GlassButton variant="secondary" onClick={onOpenChat}>
          open Chat tab instead
        </GlassButton>
      </div>
    </div>
  );
}
