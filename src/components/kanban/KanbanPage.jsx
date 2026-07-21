import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { fetchKanbanStatus, fetchKanbanList, fetchKanbanTask } from "../../lib/kanbanBridge.js";
import { PageShell } from "../PageShell.jsx";
import { DiagnosticCard } from "../DiagnosticCard.jsx";
import { KanbanCard } from "./KanbanCard.jsx";
import { KanbanDetailDrawer } from "./KanbanDetailDrawer.jsx";
import "./KanbanPage.css";

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

  return (
    <PageShell title="Kanban">
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
        {openId && <KanbanDetailDrawer detail={detail} loading={detailLoading} error={detailError} onClose={closeDrawer} />}
      </AnimatePresence>
    </PageShell>
  );
}
