import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fetchKanbanStatus, fetchKanbanList, fetchKanbanTask, createKanbanTask } from "../../lib/kanbanBridge.js";
import { PageShell } from "../PageShell.jsx";
import { DiagnosticCard } from "../DiagnosticCard.jsx";
import { KanbanCard } from "./KanbanCard.jsx";
import { KanbanDetailDrawer } from "./KanbanDetailDrawer.jsx";
import { KanbanTaskActions } from "./KanbanTaskActions.jsx";
import "./KanbanPage.css";

function NewTaskModal({ onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [assignee, setAssignee] = useState("");
  const [triage, setTriage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const onCreate = async () => {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createKanbanTask({ title, body, assignee: assignee || undefined, triage });
      onCreated();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div className="job-modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="glass-card job-modal"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.16 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="New task"
      >
        <p className="panel-section-title">New task</p>

        <label className="job-modal-label mono">
          Title
          <input className="job-modal-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
        </label>

        <label className="job-modal-label mono">
          Body
          <textarea className="job-modal-textarea mono" value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Optional opening post" />
        </label>

        <label className="job-modal-label mono">
          Assignee
          <input className="job-modal-input" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Optional profile name" />
        </label>

        <label className="job-modal-label mono kanban-modal-checkbox">
          <input type="checkbox" checked={triage} onChange={(e) => setTriage(e.target.checked)} />
          Park in triage (specify later, instead of Ready now)
        </label>

        {error && <p className="panel-error">{error}</p>}

        <div className="job-modal-actions">
          <button type="button" className="btn-pill" onClick={onClose} disabled={saving}>
            cancel
          </button>
          <button type="button" className="btn-pill" onClick={onCreate} disabled={saving}>
            {saving ? "creating…" : "create"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

const COLUMNS = [
  { key: "backlog", label: "Backlog", statuses: ["triage", "todo"] },
  { key: "ready", label: "Ready", statuses: ["ready"] },
  { key: "in_progress", label: "In progress", statuses: ["running"] },
  { key: "blocked", label: "Blocked", statuses: ["blocked", "scheduled"] },
  { key: "review", label: "Review", statuses: ["review"] },
  { key: "done", label: "Done", statuses: ["done"] },
];

/*
  KanbanPage — Marco's real operational board: Hermes/Claude/GitHub/cron
  work as durable, inspectable cards, backed by the actual `hermes kanban`
  SQLite board (src/lib/kanbanBridge.js -> vite-plugins/kanbanBridge.js),
  not a localStorage toy. Unavailable/unconfigured states are named
  explicitly rather than showing an empty board that looks like "no work
  to do" when the real reason is "bridge isn't configured".
*/
export function KanbanPage() {
  const [status, setStatus] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const st = await fetchKanbanStatus();
      setStatus(st);
      if (!st.configured) {
        setTasks([]);
        return;
      }
      const res = await fetchKanbanList({});
      setTasks(res.data || []);
      setError(null);
    } catch (err) {
      setError(err.message || String(err));
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [load]);

  const columns = useMemo(() => {
    const byKey = Object.fromEntries(COLUMNS.map((c) => [c.key, []]));
    for (const t of tasks || []) {
      const col = COLUMNS.find((c) => c.statuses.includes(t.status));
      (byKey[col?.key || "backlog"] || byKey.backlog).push(t);
    }
    return byKey;
  }, [tasks]);

  const openTask = useCallback(async (id) => {
    setOpenId(id);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await fetchKanbanTask(id);
      setDetail(res.data);
    } catch (err) {
      setDetailError(err.message || String(err));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDrawer = useCallback(() => {
    setOpenId(null);
    setDetail(null);
    setDetailError(null);
  }, []);

  const onTaskChanged = useCallback(async () => {
    await load();
    if (openId) {
      try {
        const res = await fetchKanbanTask(openId);
        setDetail(res.data);
      } catch (err) {
        setDetailError(err.message || String(err));
      }
    }
  }, [load, openId]);

  return (
    <PageShell
      title="Kanban"
      headerExtra={
        status?.configured && (
          <button type="button" className="btn-pill" onClick={() => setCreating(true)}>
            + new task
          </button>
        )
      }
    >
      {status && !status.configured && (
        <DiagnosticCard
          title="Kanban bridge not configured"
          detail="No HTTP endpoint exists for Kanban on this build — the bridge SSHes into the Hermes box and runs the real CLI instead."
          hint="Set HERMES_SSH_HOST / HERMES_SSH_KEY_PATH in .env.local (see .env.local.example)."
        />
      )}
      {error && <DiagnosticCard title="Kanban board unavailable" detail={error} hint="Check the SSH bridge can reach the box and the container is running." />}
      {!status && !error && <p className="panel-empty">Loading…</p>}

      {status?.configured && !error && (
        <div className="kanban-board">
          {COLUMNS.map((col) => (
            <div key={col.key} className="kanban-column">
              <div className="kanban-column-head">
                <span className="panel-section-title">{col.label}</span>
                <span className="kanban-column-count mono">{columns[col.key]?.length || 0}</span>
              </div>
              <div className="kanban-column-body">
                {columns[col.key]?.length === 0 && <p className="panel-empty">Empty.</p>}
                {columns[col.key]?.map((t) => (
                  <KanbanCard key={t.id} task={t} onOpen={openTask} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {openId && (
          <KanbanDetailDrawer
            detail={detail}
            loading={detailLoading}
            error={detailError}
            onClose={closeDrawer}
            actions={detail && <KanbanTaskActions task={detail.task} onChanged={onTaskChanged} />}
          />
        )}
        {creating && (
          <NewTaskModal
            onClose={() => setCreating(false)}
            onCreated={() => {
              setCreating(false);
              load();
            }}
          />
        )}
      </AnimatePresence>
    </PageShell>
  );
}
