import { useChat } from "../../state/Chat.jsx";
import { useViewMode } from "../../state/ViewMode.jsx";
import { useProjectSignals } from "../../lib/useProjectSignals.js";
import { buildProjectContextMessage } from "../../lib/projectContext.js";
import { logProjectActivity } from "../../lib/obsidianBridge.js";
import { GlassButton } from "../ui/GlassButton.jsx";

// Contextual Hermes actions (CLAUDE-005) — no /local route for
// Hermes-generated project analysis exists on this backend (see
// ProjectIntelligencePanel.jsx's header comment for the route check this
// traces back to), so every action here is the same honest shape: seed a
// real, visible context message (project.js's buildProjectContextMessage,
// now including canvas node titles and workflow step titles so these
// prompts have real material to work from) plus a plain-text instruction
// line describing what to do with it, and hand off to Chat. Nothing here
// ever displays a result as if Hermes already generated it — the actual
// generation only happens if/when Marco reviews and sends the seeded
// message himself.
const ACTIONS = [
  { key: "ask", label: "Ask Hermes about this project", instruction: null },
  {
    key: "summarize-notes",
    label: "Summarize latest notes",
    instruction: "Summarize the linked notes above — key points, and flag anything that looks outdated or unclear.",
    disabledReason: "No linked notes to summarize yet.",
    isDisabled: ({ linkedNotes }) => linkedNotes.length === 0,
  },
  {
    key: "next-steps",
    label: "Generate next steps",
    instruction: "Based on the current state above (blockers, open tasks, workflow status), suggest concrete next steps for this project.",
  },
  {
    key: "canvas-to-tasks",
    label: "Turn canvas into tasks",
    instruction: "Look at the canvas node titles listed above and propose Kanban tasks that would move each one forward — a short, concrete list I can create as tasks.",
    disabledReason: "No canvases to work from yet.",
    isDisabled: ({ canvases }) => canvases.length === 0,
  },
  {
    key: "workflow-to-kanban",
    label: "Turn workflow into Kanban",
    instruction: "Convert the workflow steps above into Kanban tasks — one task per step, keeping the step titles, noting which are already done or blocked.",
    disabledReason: "No workflows to convert yet.",
    isDisabled: ({ workflows }) => workflows.length === 0,
  },
  {
    key: "instruction-draft",
    label: "Draft a Claude instruction file",
    instruction:
      "Draft a Claude Instructions file for the next chunk of work on this project, in the same style as docs/claude/*_CLAUDE_INSTRUCTIONS_*.md (numbered chunks, objective, files likely involved, verification gate, commit rule), based on the real state above.",
  },
  {
    key: "find-blockers",
    label: "Find blockers",
    instruction: "List every blocker above clearly (blocked tasks and blocked workflow steps), and for each one suggest a concrete way to unblock it.",
    disabledReason: "Nothing is blocked right now.",
    isDisabled: ({ tasks, workflows }) => tasks.every((t) => t.status !== "blocked") && workflows.every((w) => (w.steps || []).every((s) => s.status !== "blocked")),
  },
];

/*
  ProjectChatPanel — seeds a new chat with a real, visible context message
  instead of silently attaching invisible context: no session/context API
  exists on the real backend to attach this server-side, so the message is
  put directly in the composer for Marco to see (and edit) before it's
  actually sent as the first real turn. Same builder (src/lib/
  projectContext.js) and data (src/lib/useProjectSignals.js) as
  ProjectIntelligencePanel's "Analyze in Chat" — one context builder, many
  entry points into it, each just adding a different instruction line.
*/
export function ProjectChatPanel({ project, notes }) {
  const { newChat, setDraft } = useChat();
  const { goTo } = useViewMode();
  const { canvases, workflows, tasks, assets, loading } = useProjectSignals(project);

  const linkedNotes = project.linkedNoteIds.map((id) => notes.find((n) => n.id === id)).filter(Boolean);
  const signals = { linkedNotes, canvases, workflows, tasks, assets };

  const onAction = (label, instruction) => {
    const message = buildProjectContextMessage(project, linkedNotes, canvases, workflows, tasks, assets, instruction);
    newChat();
    setDraft(message);
    goTo("chat");
    logProjectActivity(project.id, "hermes", `Hermes action launched: ${label}`);
  };

  return (
    <div className="panel-section">
      <p className="panel-section-title">Chat</p>
      <p className="panel-empty">
        Every action below starts a new chat with this project's real context pre-filled in the composer — nothing is
        sent until you review it and hit Send, and nothing above the line is model-generated.
      </p>
      <div className="project-chat-actions">
        {ACTIONS.map((a) => {
          const disabled = loading || a.isDisabled?.(signals);
          return (
            <GlassButton
              key={a.key}
              variant={a.key === "ask" ? "primary" : "secondary"}
              onClick={() => onAction(a.label, a.instruction)}
              disabled={disabled}
              title={disabled && !loading ? a.disabledReason : undefined}
            >
              {a.label}
            </GlassButton>
          );
        })}
      </div>
      <div className="notes-editor-meta" style={{ marginTop: "0.5rem" }}>
        <span className="mono panel-empty">
          {linkedNotes.length} notes · {canvases.length} canvases · {workflows.length} workflows · {tasks.length} tasks · {assets.length} assets
        </span>
      </div>
    </div>
  );
}
