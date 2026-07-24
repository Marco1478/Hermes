import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, Reorder, motion } from "framer-motion";
import {
  fetchKanbanStatus,
  fetchKanbanList,
  fetchKanbanTask,
  createKanbanTask,
  dispatchKanban,
  promoteKanbanTask,
  blockKanbanTask,
  completeKanbanTasks,
} from "../../lib/kanbanBridge.js";
import { useProjects } from "../../state/Projects.jsx";
import { useViewMode } from "../../state/ViewMode.jsx";
import { PageShell } from "../PageShell.jsx";
import { DiagnosticCard } from "../DiagnosticCard.jsx";
import { KanbanColumn } from "./KanbanColumn.jsx";
import { KanbanDetailDrawer } from "./KanbanDetailDrawer.jsx";
import { KanbanTaskActions } from "./KanbanTaskActions.jsx";
import { KanbanObsidianLinks } from "./KanbanObsidianLinks.jsx";
import { KanbanProjectAssign } from "./KanbanProjectAssign.jsx";
import { GlassButton } from "../ui/GlassButton.jsx";
import { GlassSegmented, GlassSegmentedOption } from "../ui/GlassSegmented.jsx";
import "./KanbanPage.css";

// Real, checkable buckets only — no "assigned to X" classifier beyond the
// two assignee presets this UI itself offers (NewTaskModal's "Hermes
// default"/"Claude" buttons write exactly "default"/"claude"), and no
// per-task tag filter since a real Kanban task has no tag field (only a
// project does — see the separate project-tag select below).
const FILTER_BUCKETS = [
  { key: "all", label: "All" },
  { key: "general", label: "General / Inbox" },
  { key: "blocked", label: "Blocked" },
  { key: "hermes", label: "Hermes" },
  { key: "claude", label: "Claude" },
];

function NewTaskModal({ preset, onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [assignee, setAssignee] = useState("");
  const [triage, setTriage] = useState(preset.generic ? false : Boolean(preset.triage));
  const [dispatchAfter, setDispatchAfter] = useState(false);
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
      await createKanbanTask({
        title,
        body,
        assignee: assignee || undefined,
        triage: preset.generic ? triage : preset.triage,
        initialStatus: preset.generic ? undefined : preset.initialStatus,
      });
      if (dispatchAfter) await dispatchKanban(1, false);
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
        transition={{ type: "spring", stiffness: 460, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="New task"
      >
        <p className="panel-section-title">New task</p>
        {!preset.generic && <p className="panel-empty">Creating in: {preset.label}</p>}

        <label className="job-modal-label mono">
          Title
          <input className="job-modal-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" autoFocus />
        </label>

        <label className="job-modal-label mono">
          Body
          <textarea className="job-modal-textarea mono" value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Optional opening post" />
        </label>

        <label className="job-modal-label mono">
          Assignee
          <input className="job-modal-input" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Optional profile name" />
        </label>
        <div className="kanban-assignee-presets">
          <button type="button" className="btn-pill" onClick={() => setAssignee("default")}>
            Hermes default
          </button>
          <button type="button" className="btn-pill" onClick={() => setAssignee("claude")}>
            Claude
          </button>
        </div>

        {preset.generic && (
          <label className="job-modal-label mono kanban-modal-checkbox">
            <input type="checkbox" checked={triage} onChange={(e) => setTriage(e.target.checked)} />
            Park in triage (specify later, instead of Ready now)
          </label>
        )}
        <label className="job-modal-label mono kanban-modal-checkbox">
          <input type="checkbox" checked={dispatchAfter} onChange={(e) => setDispatchAfter(e.target.checked)} />
          Dispatch immediately after creation (starts the Kanban worker if a ready assignee exists)
        </label>

        {error && <p className="panel-error">{error}</p>}

        <div className="job-modal-actions">
          <GlassButton variant="secondary" onClick={onClose} disabled={saving}>
            cancel
          </GlassButton>
          <GlassButton variant="primary" onClick={onCreate} disabled={saving}>
            {saving ? "creating…" : dispatchAfter ? "create + dispatch" : "create"}
          </GlassButton>
        </div>
      </motion.div>
    </motion.div>
  );
}

const COLUMNS = [
  { key: "backlog", label: "Backlog", statuses: ["triage", "todo"], triage: true },
  { key: "ready", label: "Ready", statuses: ["ready"], triage: false },
  { key: "in_progress", label: "In progress", statuses: ["running"] },
  { key: "blocked", label: "Blocked", statuses: ["blocked", "scheduled"], initialStatus: "blocked" },
  { key: "review", label: "Review", statuses: ["review"] },
  { key: "done", label: "Done", statuses: ["done"] },
];

// The real CLI can only place a new task straight into triage/todo, ready,
// or blocked — there's no "create straight into running/review/done"
// (see vite-plugins/hermesBridge.js). Columns without a triage/initialStatus
// preset still get the same "+" affordance for a consistent board, but it
// opens the generic modal instead of a false "creating in <column>" claim.
const hasCreatePreset = (col) => col.triage !== undefined || col.initialStatus !== undefined;
const COLUMN_ORDER_KEY = "hermes-ui.kanban.column-order.v1";
const DEFAULT_COLUMN_ORDER = COLUMNS.map((c) => c.key);

const columnKeyForStatus = (status) => COLUMNS.find((c) => c.statuses.includes(status))?.key || "backlog";

// Drag-a-card-to-a-column only ever calls a real CLI command that already
// exists for a completely different reason (promote/block/complete) — there
// is no generic "set status" endpoint (see vite-plugins/hermesBridge.js),
// and "running"/"review" are states the worker sets itself, not something a
// human command can force. Dropping on Backlog/In progress/Review is
// rejected with an explanation rather than silently doing nothing or
// inventing a fake transition.
const DROP_ACTIONS = {
  ready: (task) => promoteKanbanTask(task.id, "Moved to Ready via board drag"),
  blocked: (task) => blockKanbanTask(task.id, "Moved to Blocked via board drag"),
  done: (task) => completeKanbanTasks([task.id], "Moved to Done via board drag"),
};

function loadColumnOrder() {
  try {
    const raw = localStorage.getItem(COLUMN_ORDER_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return DEFAULT_COLUMN_ORDER;
    const valid = parsed.filter((k) => DEFAULT_COLUMN_ORDER.includes(k));
    // Any new default column not present in a saved (older) order still
    // shows up, appended at the end, instead of silently disappearing.
    return [...valid, ...DEFAULT_COLUMN_ORDER.filter((k) => !valid.includes(k))];
  } catch {
    return DEFAULT_COLUMN_ORDER;
  }
}

/*
  KanbanPage — Marco's real operational board: Hermes/Claude/GitHub/cron
  work as durable, inspectable cards, backed by the actual `hermes kanban`
  SQLite board (src/lib/kanbanBridge.js -> vite-plugins/kanbanBridge.js),
  not a localStorage toy. Unavailable/unconfigured states are named
  explicitly rather than showing an empty board that looks like "no work
  to do" when the real reason is "bridge isn't configured". Column ORDER
  is a genuine local UI preference (not backend-shaped data), so
  localStorage for that specifically is honest, not a fake.
*/
export function KanbanPage() {
  const { projects, allTags } = useProjects();
  const { kanbanFilterProjectId, consumeKanbanFilter } = useViewMode();
  const [status, setStatus] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [creating, setCreating] = useState(null); // null | { generic: true } | column preset
  const [columnOrder, setColumnOrder] = useState(loadColumnOrder);
  const [dropState, setDropState] = useState(null); // { overColumn, allowed } | null
  const [dropError, setDropError] = useState(null);
  const dropErrorTimer = useRef(null);
  const [filterBucket, setFilterBucket] = useState("all"); // all|general|project|tag|blocked|hermes|claude
  const [filterProjectId, setFilterProjectId] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [sortRecent, setSortRecent] = useState(false);

  // A project's "open in main board, filtered" link arrives here as a
  // one-shot pending value (see ViewMode.jsx) rather than a URL param —
  // this app has no router. Consumed immediately so navigating to Kanban
  // again later (via the rail) starts unfiltered, not stuck on the last
  // project.
  useEffect(() => {
    if (kanbanFilterProjectId) {
      setFilterBucket("project");
      setFilterProjectId(kanbanFilterProjectId);
      consumeKanbanFilter();
    }
  }, [kanbanFilterProjectId, consumeKanbanFilter]);

  const selectBucket = (key) => {
    setFilterBucket(key);
    setFilterProjectId("");
    setFilterTag("");
  };

  const onReorder = useCallback((next) => {
    setColumnOrder(next);
    try {
      localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(next));
    } catch {
      /* best effort */
    }
  }, []);

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

  // Project<->task relation lives on the project side (linkedKanbanIds in
  // its Obsidian frontmatter) — there's no projectId field on a real
  // Kanban task (verified against the CLI's actual create/update args), so
  // this doesn't invent one. One pass over the already-loaded projects
  // builds the reverse lookup a card needs to show its project chip, and
  // that the filter bar below needs for General/Project/Tag buckets.
  const projectByTaskId = useMemo(() => {
    const map = new Map();
    for (const p of projects) for (const taskId of p.linkedKanbanIds || []) map.set(taskId, p);
    return map;
  }, [projects]);

  // One task list, filtered — never a second fetch or a separate store, so
  // there's no way for this to drift into a duplicate/phantom task. Sort
  // and bucket both operate on the same already-loaded `tasks`.
  const visibleTasks = useMemo(() => {
    let list = tasks || [];
    if (filterBucket === "general") list = list.filter((t) => !projectByTaskId.has(t.id));
    else if (filterBucket === "project" && filterProjectId) list = list.filter((t) => projectByTaskId.get(t.id)?.id === filterProjectId);
    else if (filterBucket === "tag" && filterTag) list = list.filter((t) => (projectByTaskId.get(t.id)?.tags || []).includes(filterTag));
    else if (filterBucket === "blocked") list = list.filter((t) => t.status === "blocked");
    else if (filterBucket === "hermes") list = list.filter((t) => (t.assignee || "").toLowerCase() === "default");
    else if (filterBucket === "claude") list = list.filter((t) => (t.assignee || "").toLowerCase() === "claude");
    if (sortRecent) {
      list = [...list].sort((a, b) => (b.completed_at || b.started_at || b.created_at || 0) - (a.completed_at || a.started_at || a.created_at || 0));
    }
    return list;
  }, [tasks, filterBucket, filterProjectId, filterTag, sortRecent, projectByTaskId]);

  const columns = useMemo(() => {
    const byKey = Object.fromEntries(COLUMNS.map((c) => [c.key, []]));
    for (const t of visibleTasks) {
      const col = COLUMNS.find((c) => c.statuses.includes(t.status));
      (byKey[col?.key || "backlog"] || byKey.backlog).push(t);
    }
    return byKey;
  }, [visibleTasks]);

  const orderedColumns = useMemo(
    () => columnOrder.map((key) => COLUMNS.find((c) => c.key === key)).filter(Boolean),
    [columnOrder]
  );

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

  const showDropError = useCallback((message) => {
    clearTimeout(dropErrorTimer.current);
    setDropError(message);
    dropErrorTimer.current = setTimeout(() => setDropError(null), 6000);
  }, []);

  // Live hover feedback while a card is being dragged — task itself hasn't
  // moved yet, this just tells the column under the pointer whether letting
  // go here would do anything.
  const onCardDragChange = useCallback(
    (taskId, overColumn) => {
      if (!taskId || !overColumn) {
        setDropState(null);
        return;
      }
      const task = (tasks || []).find((t) => t.id === taskId);
      const currentColumn = task ? columnKeyForStatus(task.status) : null;
      setDropState({ overColumn, allowed: overColumn !== currentColumn && Boolean(DROP_ACTIONS[overColumn]) });
    },
    [tasks]
  );

  const onCardDrop = useCallback(
    async (task, columnKey) => {
      setDropState(null);
      if (!columnKey) return;
      const currentColumn = columnKeyForStatus(task.status);
      if (columnKey === currentColumn) return;
      const action = DROP_ACTIONS[columnKey];
      if (!action) {
        const label = COLUMNS.find((c) => c.key === columnKey)?.label || columnKey;
        showDropError(`Can't drop directly on "${label}" — that status is set by the worker, not a direct command. Try Ready, Blocked, or Done, or open the card for other actions.`);
        return;
      }
      try {
        await action(task);
        await load();
      } catch (err) {
        showDropError(err.message || String(err));
      }
    },
    [load, showDropError]
  );

  return (
    <PageShell
      title="Kanban"
      wide
      headerExtra={
        status?.configured && (
          <button type="button" className="btn-pill" onClick={() => setCreating({ generic: true })}>
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
      {dropError && <p className="panel-error kanban-drop-error">{dropError}</p>}

      {status?.configured && !error && (
        <div className="kanban-filter-bar">
          <GlassSegmented>
            {FILTER_BUCKETS.map((b) => (
              <GlassSegmentedOption key={b.key} active={filterBucket === b.key} onClick={() => selectBucket(b.key)}>
                {b.label}
              </GlassSegmentedOption>
            ))}
          </GlassSegmented>
          <select
            className="kanban-filter-select mono"
            value={filterBucket === "project" ? filterProjectId : ""}
            onChange={(e) => {
              const id = e.target.value;
              setFilterBucket(id ? "project" : "all");
              setFilterProjectId(id);
              setFilterTag("");
            }}
          >
            <option value="">by project…</option>
            {projects
              .filter((p) => !p.archived && (p.linkedKanbanIds || []).length > 0)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || "Untitled project"}
                </option>
              ))}
          </select>
          {allTags.length > 0 && (
            <select
              className="kanban-filter-select mono"
              value={filterBucket === "tag" ? filterTag : ""}
              onChange={(e) => {
                const tag = e.target.value;
                setFilterBucket(tag ? "tag" : "all");
                setFilterTag(tag);
                setFilterProjectId("");
              }}
              title="Filters by the tag on a task's linked project — a real Kanban task has no tag field of its own."
            >
              <option value="">by project tag…</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  #{t}
                </option>
              ))}
            </select>
          )}
          <button type="button" className={`btn-pill${sortRecent ? " btn-pill--active" : ""}`} onClick={() => setSortRecent((v) => !v)}>
            {sortRecent ? "✓ recently updated" : "recently updated"}
          </button>
        </div>
      )}

      {status?.configured && !error && (
        <Reorder.Group
          as="div"
          axis="x"
          values={columnOrder}
          onReorder={onReorder}
          className="kanban-board"
          style={{ gridTemplateColumns: `repeat(${orderedColumns.length}, minmax(0, 1fr))` }}
        >
          {orderedColumns.map((col) => (
            <KanbanColumn
              key={col.key}
              col={col}
              tasks={columns[col.key] || []}
              onOpen={openTask}
              onAddCard={(c) => setCreating(hasCreatePreset(c) ? c : { generic: true })}
              projectByTaskId={projectByTaskId}
              onCardDragChange={onCardDragChange}
              onCardDrop={onCardDrop}
              dropState={dropState}
            />
          ))}
        </Reorder.Group>
      )}

      <AnimatePresence>
        {openId && (
          <KanbanDetailDrawer
            detail={detail}
            loading={detailLoading}
            error={detailError}
            onClose={closeDrawer}
            actions={
              detail && (
                <>
                  <KanbanProjectAssign task={detail.task} project={projectByTaskId.get(detail.task.id)} />
                  <KanbanTaskActions task={detail.task} onChanged={onTaskChanged} />
                  <KanbanObsidianLinks task={detail.task} onChanged={onTaskChanged} />
                </>
              )
            }
          />
        )}
        {creating && (
          <NewTaskModal
            preset={creating}
            onClose={() => setCreating(null)}
            onCreated={() => {
              setCreating(null);
              load();
            }}
          />
        )}
      </AnimatePresence>
    </PageShell>
  );
}
