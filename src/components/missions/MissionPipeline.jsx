import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchMissionInstructions, fetchMissionStatusReports } from "../../lib/missionBridge.js";
import { createKanbanTask } from "../../lib/kanbanBridge.js";
import { PageShell } from "../PageShell.jsx";
import { DiagnosticCard } from "../DiagnosticCard.jsx";
import "./MissionPipeline.css";

/*
  MissionPipeline — links real docs/claude/*.md instruction files to real
  docs/claude/status/*.md reports, by literal CLAUDE-### id matching (both
  parsed server-side, see vite-plugins/missionBridge.js). A chunk with no
  status report mentioning its id is shown as unknown, never as done —
  status is read off the files, not guessed.
*/
export function MissionPipeline() {
  const [instructions, setInstructions] = useState(null);
  const [reports, setReports] = useState(null);
  const [error, setError] = useState(null);
  const [cardState, setCardState] = useState({}); // chunkId -> "creating" | "created" | error string

  const load = useCallback(async () => {
    try {
      const [instrRes, reportsRes] = await Promise.all([fetchMissionInstructions(), fetchMissionStatusReports()]);
      setInstructions(instrRes.files);
      setReports(reportsRes.reports);
      setError(null);
    } catch (err) {
      setError(err.message || String(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const chunkReportMap = useMemo(() => {
    const map = {};
    for (const r of reports || []) {
      for (const id of r.mentionsChunks) {
        (map[id] ||= []).push(r);
      }
    }
    return map;
  }, [reports]);

  const latest = instructions?.[0];

  async function onCreateCard(chunk) {
    setCardState((s) => ({ ...s, [chunk.id]: "creating" }));
    try {
      await createKanbanTask({ title: `${chunk.id} — ${chunk.title}`, body: chunk.objective || "", triage: true });
      setCardState((s) => ({ ...s, [chunk.id]: "created" }));
    } catch (err) {
      setCardState((s) => ({ ...s, [chunk.id]: err.message || String(err) }));
    }
  }

  return (
    <PageShell title="Missions">
      {error && <DiagnosticCard title="Mission data unavailable" detail={error} hint="docs/claude/ must exist and be readable by the Vite dev server." />}
      {!instructions && !error && <p className="panel-empty">Loading…</p>}

      {latest && (
        <div className="panel-section">
          <p className="panel-section-title">Current instruction file — {latest.file}</p>
          <p className="mission-file-title">{latest.title}</p>
          <div className="mission-chunk-list">
            {latest.chunks.map((chunk) => {
              const chunkReports = chunkReportMap[chunk.id] || [];
              const state = cardState[chunk.id];
              return (
                <div key={chunk.id} className="panel-card mission-chunk">
                  <div className="mission-chunk-head">
                    <span className="tag-badge">{chunk.id}</span>
                    <span className={`status-badge ${chunkReports.length > 0 ? "status-badge--ok" : ""}`}>
                      {chunkReports.length > 0 ? "reported" : "unknown"}
                    </span>
                  </div>
                  <p className="mission-chunk-title">{chunk.title}</p>
                  {chunk.objective && <p className="mission-chunk-objective">{chunk.objective}</p>}
                  {chunkReports.map((r) => (
                    <p key={r.file} className="mission-chunk-report mono">
                      ↳ {r.title || r.file}
                    </p>
                  ))}
                  <button type="button" className="btn-pill" disabled={state === "creating" || state === "created"} onClick={() => onCreateCard(chunk)}>
                    {state === "created" ? "card created ✓" : state === "creating" ? "creating…" : "create kanban card"}
                  </button>
                  {state && state !== "creating" && state !== "created" && <p className="panel-error">{state}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="panel-section">
        <p className="panel-section-title">Status reports</p>
        {reports?.length === 0 && <p className="panel-empty">No status reports yet.</p>}
        <div className="mission-report-list">
          {reports?.map((r) => (
            <div key={r.file} className={`panel-card mission-report${r.isBlocker ? " mission-report--blocker" : ""}`}>
              <span className="mission-report-title">{r.title || r.file}</span>
              <span className="mission-report-meta mono">
                {r.file} · {new Date(r.mtime).toLocaleString()}
                {r.isBlocker && " · BLOCKER"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {instructions?.length > 1 && (
        <div className="panel-section">
          <p className="panel-section-title">Earlier instruction files</p>
          <div className="mission-report-list">
            {instructions.slice(1).map((f) => (
              <div key={f.file} className="panel-card mission-report">
                <span className="mission-report-title">{f.title || f.file}</span>
                <span className="mission-report-meta mono">
                  {f.file} · {f.chunks.length} chunk(s)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  );
}
