import { useState } from "react";
import {
  assignKanbanTask,
  commentKanbanTask,
  blockKanbanTask,
  unblockKanbanTasks,
  completeKanbanTasks,
  archiveKanbanTasks,
  linkKanbanTasks,
} from "../../lib/kanbanBridge.js";

const BLOCK_KINDS = ["needs_input", "capability", "dependency", "transient"];

/*
  KanbanTaskActions — every real write the CLI supports for a single task,
  wired to the actual bridge (no optimistic fake state; each button shows
  its own busy/error and calls onChanged() to re-fetch real state after).
  Assignee is free text, not a fixed Hermes/Claude/Marco enum — the real
  backend takes any profile name (verified via `hermes kanban assignees`),
  and a closed dropdown would either lie about what's assignable or block
  valid profiles this UI doesn't know about yet.
*/
export function KanbanTaskActions({ task, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const [assignee, setAssignee] = useState(task.assignee || "");
  const [commentText, setCommentText] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [blockKind, setBlockKind] = useState("");
  const [unblockReason, setUnblockReason] = useState("");
  const [result, setResult] = useState("");
  const [linkOtherId, setLinkOtherId] = useState("");
  const [linkDirection, setLinkDirection] = useState("child"); // this task is parent of linkOtherId, or child of it

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onChanged();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const isBlocked = task.status === "blocked" || task.status === "scheduled";
  const isTerminal = task.status === "done" || task.status === "archived";

  return (
    <div className="panel-section kanban-actions">
      <p className="panel-section-title">Actions</p>
      {error && <p className="panel-error">{error}</p>}

      <div className="kanban-action-row">
        <input
          className="kanban-action-input"
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          placeholder="profile name"
        />
        <button type="button" className="btn-pill" disabled={busy || !assignee} onClick={() => run(() => assignKanbanTask(task.id, assignee))}>
          assign
        </button>
      </div>

      <div className="kanban-action-row kanban-action-row--stack">
        <textarea
          className="kanban-action-textarea"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Add a comment…"
          rows={2}
        />
        <button
          type="button"
          className="btn-pill"
          disabled={busy || !commentText.trim()}
          onClick={() =>
            run(async () => {
              await commentKanbanTask(task.id, commentText);
              setCommentText("");
            })
          }
        >
          comment
        </button>
      </div>

      {!isBlocked && !isTerminal && (
        <div className="kanban-action-row">
          <input
            className="kanban-action-input"
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder="block reason"
          />
          <select className="kanban-action-input" value={blockKind} onChange={(e) => setBlockKind(e.target.value)}>
            <option value="">kind…</option>
            {BLOCK_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-pill btn-pill--danger"
            disabled={busy}
            onClick={() => run(() => blockKanbanTask(task.id, blockReason, blockKind || undefined))}
          >
            block
          </button>
        </div>
      )}

      {isBlocked && (
        <div className="kanban-action-row">
          <input
            className="kanban-action-input"
            value={unblockReason}
            onChange={(e) => setUnblockReason(e.target.value)}
            placeholder="unblock note (optional)"
          />
          <button type="button" className="btn-pill" disabled={busy} onClick={() => run(() => unblockKanbanTasks([task.id], unblockReason))}>
            unblock
          </button>
        </div>
      )}

      {!isTerminal && (
        <div className="kanban-action-row">
          <input className="kanban-action-input" value={result} onChange={(e) => setResult(e.target.value)} placeholder="result summary" />
          <button type="button" className="btn-pill" disabled={busy} onClick={() => run(() => completeKanbanTasks([task.id], result))}>
            complete
          </button>
        </div>
      )}

      <div className="kanban-action-row">
        <input
          className="kanban-action-input"
          value={linkOtherId}
          onChange={(e) => setLinkOtherId(e.target.value)}
          placeholder="other task id"
        />
        <select className="kanban-action-input" value={linkDirection} onChange={(e) => setLinkDirection(e.target.value)}>
          <option value="child">this → child</option>
          <option value="parent">this → parent</option>
        </select>
        <button
          type="button"
          className="btn-pill"
          disabled={busy || !linkOtherId}
          onClick={() =>
            run(() =>
              linkDirection === "child" ? linkKanbanTasks(task.id, linkOtherId) : linkKanbanTasks(linkOtherId, task.id)
            )
          }
        >
          link
        </button>
      </div>

      <div className="kanban-action-row">
        <button type="button" className="btn-pill btn-pill--danger" disabled={busy} onClick={() => run(() => archiveKanbanTasks([task.id]))}>
          archive
        </button>
      </div>
    </div>
  );
}
