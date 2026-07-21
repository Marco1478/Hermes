import { useEffect, useMemo, useState } from "react";
import { fetchCronJobs } from "../../lib/hermesBridge.js";
import { fetchKanbanList } from "../../lib/kanbanBridge.js";
import { fetchRecentCommits, fetchClaudeStatusDocs } from "../../lib/activityBridge.js";
import { useChat } from "../../state/Chat.jsx";
import { DiagnosticCard } from "../DiagnosticCard.jsx";
import "./ActivityCenter.css";

const FILTERS = ["Hermes", "Claude", "Cron", "GitHub", "Kanban", "Blockers"];

function relTimeAgo(sec) {
  if (!sec) return "—";
  const s = Math.round(Date.now() / 1000 - sec);
  if (s < 0) return "now";
  if (s < 60) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function cronToEvent(job) {
  if (!job.last_run_at) return null;
  const ts = new Date(job.last_run_at).getTime() / 1000;
  const status = job.last_status === "error" ? "failed" : job.last_status === "ok" ? "success" : "info";
  return { ts, actor: "Hermes", source: "Cron", status, title: `Cron "${job.name || job.id}" ran`, filterKey: "Cron" };
}

function kanbanToEvent(task) {
  const ts = task.completed_at || task.started_at || task.created_at;
  const status = task.status === "blocked" ? "blocked" : task.status === "done" ? "success" : task.status === "running" ? "running" : "info";
  return { ts, actor: task.assignee || "unassigned", source: "Kanban", status, title: `${task.id} — ${task.title}`, filterKey: task.status === "blocked" ? "Blockers" : "Kanban" };
}

function commitToEvent(c) {
  const ts = new Date(c.date).getTime() / 1000;
  return { ts, actor: c.author, source: "GitHub", status: "success", title: c.subject, filterKey: "GitHub" };
}

function statusDocToEvent(d) {
  const ts = new Date(d.mtime).getTime() / 1000;
  return { ts, actor: "Claude", source: "Claude", status: "success", title: d.file, filterKey: "Claude" };
}

function sessionToEvent(c) {
  if (c.empty) return null;
  return { ts: c.updatedAt / 1000, actor: "Marco", source: "Hermes", status: "info", title: `Session "${c.title}"`, filterKey: "Hermes" };
}

/*
  ActivityCenter — a real cross-source timeline, not a fabricated demo feed.
  Every entry traces back to a live fetch (cron/kanban/git/claude-status/
  sessions); a source that errors renders its own DiagnosticCard instead of
  silently vanishing from the merged timeline. `compact` renders a short
  System Overview summary card; the full view (no `compact`) adds filters.
*/
export function ActivityCenter({ compact = false }) {
  const { chatList } = useChat();
  const [cronJobs, setCronJobs] = useState(null);
  const [kanbanTasks, setKanbanTasks] = useState(null);
  const [commits, setCommits] = useState(null);
  const [statusDocs, setStatusDocs] = useState(null);
  const [errors, setErrors] = useState({});
  const [activeFilter, setActiveFilter] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [cronRes, kanbanRes, gitRes, docsRes] = await Promise.allSettled([
        fetchCronJobs(),
        fetchKanbanList({ sort: "updated" }),
        fetchRecentCommits(),
        fetchClaudeStatusDocs(),
      ]);
      if (!mounted) return;
      const errs = {};
      if (cronRes.status === "fulfilled") setCronJobs(cronRes.value || []);
      else errs.Cron = cronRes.reason?.message || "unavailable";
      if (kanbanRes.status === "fulfilled") setKanbanTasks(kanbanRes.value.data || []);
      else errs.Kanban = kanbanRes.reason?.message || "unavailable";
      if (gitRes.status === "fulfilled") setCommits(gitRes.value.commits || []);
      else errs.GitHub = gitRes.reason?.message || "unavailable";
      if (docsRes.status === "fulfilled") setStatusDocs(docsRes.value.docs || []);
      else errs.Claude = docsRes.reason?.message || "unavailable";
      setErrors(errs);
    }
    load();
    const timer = setInterval(load, 30000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const events = useMemo(() => {
    const list = [
      ...(cronJobs || []).map(cronToEvent),
      ...(kanbanTasks || []).map(kanbanToEvent),
      ...(commits || []).map(commitToEvent),
      ...(statusDocs || []).map(statusDocToEvent),
      ...(chatList || []).map(sessionToEvent),
    ].filter(Boolean);
    list.sort((a, b) => b.ts - a.ts);
    return list;
  }, [cronJobs, kanbanTasks, commits, statusDocs, chatList]);

  const visible = compact ? events.slice(0, 5) : activeFilter ? events.filter((e) => e.filterKey === activeFilter) : events;
  const hasAnySource = cronJobs || kanbanTasks || commits || statusDocs;

  return (
    <div className="panel-section">
      <p className="panel-section-title">{compact ? "Activity" : "Agent Activity Center"}</p>

      {!compact && (
        <div className="activity-filters">
          <button type="button" className={`tag-badge activity-filter${!activeFilter ? " activity-filter--active" : ""}`} onClick={() => setActiveFilter(null)}>
            all
          </button>
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`tag-badge activity-filter${activeFilter === f ? " activity-filter--active" : ""}`}
              onClick={() => setActiveFilter(f)}
            >
              {f.toLowerCase()}
            </button>
          ))}
        </div>
      )}

      {!compact &&
        Object.entries(errors).map(([source, msg]) => <DiagnosticCard key={source} title={`${source} activity unavailable`} detail={msg} />)}

      <div className={compact ? "activity-list activity-list--compact" : "activity-list"}>
        {!hasAnySource && <p className="panel-empty">Loading…</p>}
        {hasAnySource && visible.length === 0 && <p className="panel-empty">No activity.</p>}
        {visible.map((e, i) => (
          <div key={i} className="panel-card activity-row">
            <span className={`led-dot led-dot--${e.status === "success" ? "on" : e.status === "blocked" || e.status === "failed" ? "bad" : e.status === "running" ? "warn led-dot--pulse" : ""}`} />
            <div className="activity-row-body">
              <span className="activity-row-title">{e.title}</span>
              <span className="activity-row-meta mono">
                {e.source} · {e.actor} · {relTimeAgo(e.ts)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
