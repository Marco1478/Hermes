import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchCronJobs, pauseCronJob, resumeCronJob, triggerCronJob, updateCronJob } from "../../lib/hermesBridge.js";
import { PageShell } from "../PageShell.jsx";
import { DiagnosticCard } from "../DiagnosticCard.jsx";
import "./JobsPage.css";

function relTime(iso) {
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return "—";
  const abs = Math.abs(ms);
  const s = Math.round(abs / 1000);
  const label = s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : s < 86400 ? `${Math.round(s / 3600)}h` : `${Math.round(s / 86400)}d`;
  return ms >= 0 ? `in ${label}` : `${label} ago`;
}

function PlayIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function StatusBadge({ job }) {
  if (job.state === "running") return <span className="status-badge status-badge--info">Running</span>;
  if (!job.enabled) return <span className="status-badge">Paused</span>;
  if (job.last_status === "ok") return <span className="status-badge status-badge--ok">Success</span>;
  if (job.last_status === "error") return <span className="status-badge status-badge--bad">Failed</span>;
  return <span className="status-badge">Scheduled</span>;
}

function EditJobModal({ job, onClose, onSaved }) {
  const [name, setName] = useState(job.name || "");
  const [prompt, setPrompt] = useState(job.prompt || "");
  const [expr, setExpr] = useState(job.schedule?.expr || job.schedule_display || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const onSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateCronJob(job.id, { name, prompt, schedule: { kind: "cron", expr } });
      onSaved();
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
        aria-label="Edit job"
      >
        <p className="panel-section-title">Edit job</p>

        <label className="job-modal-label mono">
          Name
          <input className="job-modal-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="job-modal-label mono">
          Cron expression
          <input className="job-modal-input mono" value={expr} onChange={(e) => setExpr(e.target.value)} placeholder="0 7,16 * * *" />
        </label>

        <label className="job-modal-label mono">
          Prompt
          <textarea className="job-modal-textarea mono" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={8} />
        </label>

        {error && <p className="panel-error">{error}</p>}

        <div className="job-modal-actions">
          <button type="button" className="btn-pill" onClick={onClose} disabled={saving}>
            cancel
          </button>
          <button type="button" className="btn-pill" onClick={onSave} disabled={saving}>
            {saving ? "saving…" : "save"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function JobCard({ job, onAction, onEdit, busy }) {
  return (
    <div className="glass-card job-card">
      <div className="job-card-head">
        <span className="job-name">{job.name || job.id}</span>
        <StatusBadge job={job} />
      </div>

      <p className="job-prompt">{job.prompt}</p>

      <div className="job-meta mono">
        <span>{job.schedule_display || job.schedule?.expr || "—"}</span>
        <span>next {relTime(job.next_run_at)}</span>
        <span>last {relTime(job.last_run_at)}</span>
        {job.enabled_toolsets?.length > 0 && <span>tools {job.enabled_toolsets.join(", ")}</span>}
      </div>

      {job.last_error && <p className="panel-error">{job.last_error}</p>}

      <div className="job-actions">
        <label className="toggle-switch" title={job.enabled ? "Pause schedule" : "Resume schedule"}>
          <input
            type="checkbox"
            checked={job.enabled}
            disabled={busy}
            onChange={() => onAction(job.id, job.enabled ? "pause" : "resume")}
          />
          <span className="toggle-switch-track" />
        </label>

        <button type="button" className="btn-pill btn-pill--icon" disabled={busy} title="Run now" onClick={() => onAction(job.id, "trigger")}>
          <PlayIcon />
        </button>
        <button type="button" className="btn-pill btn-pill--icon" title="Edit" onClick={() => onEdit(job)}>
          <EditIcon />
        </button>
      </div>
    </div>
  );
}

/*
  JobsPage — Hermes's cron jobs: a 2-3 col grid, each card with a live
  toggle (pause/resume), Run Now, and an Edit modal for name/prompt/cron
  expression. Sourced from the dashboard's richer /api/cron/jobs.
*/
export function JobsPage() {
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [editingJob, setEditingJob] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchCronJobs();
      setJobs(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.message || String(err));
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);

  const onAction = useCallback(
    async (id, action) => {
      setBusyId(id);
      try {
        if (action === "pause") await pauseCronJob(id);
        else if (action === "resume") await resumeCronJob(id);
        else if (action === "trigger") await triggerCronJob(id);
        await load();
      } catch (err) {
        setError(err.message || String(err));
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  return (
    <PageShell title="Jobs">
      <div className="panel-section">
        <p className="panel-section-title">Cron jobs</p>
        {error && !jobs && (
          <DiagnosticCard
            title="Cron jobs unavailable"
            detail={error}
            hint="Check HERMES_DASHBOARD_BASE_URL/USERNAME/PASSWORD in .env.local, or that the dashboard container is reachable."
          />
        )}
        {error && jobs && <p className="panel-error">{error}</p>}
        {!jobs && !error && <p className="panel-empty">Loading…</p>}
        {jobs && jobs.length === 0 && <p className="panel-empty">No cron jobs configured.</p>}
        <div className="job-grid">
          {jobs?.map((job) => (
            <JobCard key={job.id} job={job} onAction={onAction} onEdit={setEditingJob} busy={busyId === job.id} />
          ))}
        </div>
      </div>

      <AnimatePresence>
        {editingJob && (
          <EditJobModal
            job={editingJob}
            onClose={() => setEditingJob(null)}
            onSaved={() => {
              setEditingJob(null);
              load();
            }}
          />
        )}
      </AnimatePresence>
    </PageShell>
  );
}
