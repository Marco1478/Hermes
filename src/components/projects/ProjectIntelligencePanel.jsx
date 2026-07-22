import { useMemo } from "react";
import { useChat } from "../../state/Chat.jsx";
import { useViewMode } from "../../state/ViewMode.jsx";
import { useProjectSignals } from "../../lib/useProjectSignals.js";
import { buildProjectContextMessage } from "../../lib/projectContext.js";
import { GlassButton } from "../ui/GlassButton.jsx";

function relTimeAgo(ms) {
  if (!ms) return "—";
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function Tile({ label, value, sub, tone }) {
  return (
    <div className={`overview-tile${tone ? ` overview-tile--${tone}` : ""}`}>
      <span className="overview-tile-label mono">{label}</span>
      <span className="overview-tile-value">{value}</span>
      {sub && <span className="overview-tile-sub mono">{sub}</span>}
    </div>
  );
}

/*
  ProjectIntelligencePanel — a deterministic operational summary, not an LLM
  feature: no /local route for Hermes-generated project analysis exists yet
  (grepped vite-plugins/), so this only ever shows numbers it can actually
  count. "Last updated" is note-only because canvases/workflows are plain
  JSON files the bridge never stat()s or timestamps (see
  vite-plugins/obsidianBridge.js's listFiles) — inventing one would violate
  the no-fake-backend-fields rule the rest of this app follows.

  "Analyze in Chat" seeds the exact same rich context message
  ProjectChatPanel's own button does (shared builder in
  src/lib/projectContext.js) and jumps straight to Chat with it in the
  composer — one click, not "switch tabs, then find the other button."
*/
export function ProjectIntelligencePanel({ project, notes, onOpenChat }) {
  const { newChat, setDraft } = useChat();
  const { goTo } = useViewMode();
  const { canvases, workflows, tasks, loading, error: loadError } = useProjectSignals(project);

  const linkedNotes = useMemo(() => project.linkedNoteIds.map((id) => notes.find((n) => n.id === id)).filter((n) => n && !n.archived), [project.linkedNoteIds, notes]);

  const lastUpdatedNote = useMemo(() => (linkedNotes.length ? linkedNotes.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a)) : null), [linkedNotes]);

  const activeWorkflows = workflows.filter((w) => w.status !== "done");
  const openTasks = tasks.filter((t) => t.status !== "done");
  const blockedTasks = tasks.filter((t) => t.status === "blocked");
  const blockedSteps = workflows.reduce((sum, w) => sum + (w.steps || []).filter((s) => s.status === "blocked").length, 0);
  const totalBlocked = blockedTasks.length + blockedSteps;

  const nextAction = loading
    ? null
    : totalBlocked > 0
      ? `${totalBlocked} blocked item${totalBlocked === 1 ? "" : "s"} — clear ${blockedTasks.length > 0 ? "the Kanban tab" : "the Workflows tab"} first.`
      : linkedNotes.length === 0 && workflows.length === 0 && tasks.length === 0
        ? "Nothing linked yet — add a note, canvas, workflow, or task to get this project moving."
        : openTasks.length > 0
          ? `${openTasks.length} open Kanban task${openTasks.length === 1 ? "" : "s"} — check the Kanban tab.`
          : "Nothing obviously blocking right now.";

  const onAnalyzeInChat = () => {
    const message = buildProjectContextMessage(project, linkedNotes, canvases, workflows, tasks);
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
          {project.description?.trim() || "No description yet — add one from the Overview tab."}
        </p>
      </div>

      {loadError && <p className="panel-error">{loadError}</p>}
      {loading && <p className="panel-empty">Loading…</p>}

      {!loading && (
        <>
          <div className="overview-tile-grid">
            <Tile label="ACTIVE NOTES" value={linkedNotes.length} />
            <Tile label="ACTIVE WORKFLOWS" value={activeWorkflows.length} sub={`${workflows.length} total`} />
            <Tile label="OPEN TASKS" value={openTasks.length} sub={`${tasks.length} linked`} />
            <Tile label="BLOCKED" value={totalBlocked} tone={totalBlocked > 0 ? "bad" : "ok"} sub={`${blockedTasks.length} task, ${blockedSteps} step`} />
          </div>

          <p className="panel-section-title" style={{ marginTop: "0.9rem", marginBottom: "0.3rem" }}>
            Last updated
          </p>
          <p className="panel-empty" style={{ margin: 0 }}>
            {lastUpdatedNote ? (
              <>
                Note “{lastUpdatedNote.title || "Untitled"}” — {relTimeAgo(lastUpdatedNote.updatedAt)}
              </>
            ) : (
              "No linked notes yet."
            )}{" "}
            (canvases/workflows don't carry a modification timestamp in this build.)
          </p>

          <p className="panel-section-title" style={{ marginTop: "0.9rem", marginBottom: "0.3rem" }}>
            Suggested next action
          </p>
          <p className="panel-empty" style={{ margin: 0 }}>
            {nextAction}
          </p>
        </>
      )}

      <p className="panel-section-title" style={{ marginTop: "0.9rem", marginBottom: "0.3rem" }}>
        Ask Hermes
      </p>
      <p className="panel-empty" style={{ margin: 0 }}>
        No Hermes analysis endpoint exists on this build yet — no summary below is model-generated. This seeds the real project
        data above into a new chat message for you to review and send.
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
