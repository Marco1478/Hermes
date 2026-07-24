import { useCallback, useEffect, useState } from "react";
import { fetchProjectActivity } from "../../lib/obsidianBridge.js";

// Exported for ProjectOverviewPanel's cozy "Latest activity" mini-list —
// one glyph vocabulary for activity entries, not two.
export const TYPE_GLYPH = {
  project: "●",
  note: "🔗",
  canvas: "▭",
  workflow: "☰",
  kanban: "▤",
  asset: "📎",
  hermes: "✦",
  claude_code: "▶",
};

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

/*
  ProjectActivityPanel — a real timeline (CLAUDE-006 of Instructions 009),
  not derived from guesswork: canvases/workflows/assets carry no
  modification timestamp anywhere else in this build (see
  ProjectOverviewPanel.jsx's own "Latest changes" section for that same
  limitation), so there's no way to reconstruct "what happened and when"
  from existing metadata alone. This reads a real, vault-backed,
  append-only log (Hermes/Projects/<Project>/activity.json, written by
  logProjectActivity — see its call sites: project creation, note link/
  unlink, canvas/workflow creation, asset upload, Hermes actions launched,
  Kanban task completed/blocked) instead of inventing one. Read-only here —
  nothing on this tab writes.

  `claude_code` (CLAUDE-007 of Instructions 010) is real render support
  for an event type nothing currently emits: this build has no per-project
  Claude Code runner, so there's no honest way to attribute a run to one
  project. If/when a server-side runner starts calling this same append
  API with that type, it renders here with no further UI change needed —
  see ProjectOverviewPanel's "Claude Code" action for the site-wide (not
  project-scoped) view that exists today instead.
*/
export function ProjectActivityPanel({ project }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchProjectActivity(project.id);
      setEntries(res.data || []);
      setError(null);
    } catch (err) {
      setError(err.message || String(err));
    }
  }, [project.id]);

  useEffect(() => {
    load();
  }, [load]);

  const sorted = entries ? [...entries].reverse() : null;

  return (
    <div className="panel-section">
      <div className="project-section-head">
        <p className="panel-section-title" style={{ marginBottom: 0 }}>
          Activity {sorted && sorted.length > 0 && <span className="mono">({sorted.length})</span>}
        </p>
        <button type="button" className="btn-pill" onClick={load}>
          refresh
        </button>
      </div>

      {error && <p className="panel-error">Couldn't load activity: {error}</p>}
      {!sorted && !error && <p className="panel-empty">Loading…</p>}
      {sorted && sorted.length === 0 && (
        <p className="panel-empty">
          Nothing logged yet — activity appears here as you link notes, create canvases/workflows, upload assets,
          complete/block Kanban tasks, or launch Hermes actions on this project.
        </p>
      )}

      <div className="project-activity-list">
        {sorted?.map((entry, i) => (
          <div key={`${entry.ts}-${i}`} className="project-activity-row">
            <span className="project-activity-glyph" aria-hidden="true">
              {TYPE_GLYPH[entry.type] || "•"}
            </span>
            <span className="project-activity-label">{entry.label}</span>
            <span className="project-activity-time mono">{relTimeAgo(entry.ts)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
