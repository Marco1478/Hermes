import { useState } from "react";
import "./BackendTestCenter.css";

/*
  BackendTestCenter — runs the real scripts/smoke-backend.mjs (same one
  `npm run smoke` runs) via /local/smoke/run and shows its actual result.
  No separate "UI smoke logic" duplicating the script — one source of
  truth for what "backend healthy" means.
*/
export function BackendTestCenter() {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/local/smoke/run", { method: "POST" });
      const data = await res.json();
      if (data.ok === false && !data.results) throw new Error(data.error || "smoke run failed");
      setReport(data);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setRunning(false);
    }
  }

  const groups = report ? [...new Set(report.results.map((r) => r.group))] : [];

  return (
    <div className="panel-section">
      <div className="safety-section-head">
        <p className="panel-section-title">Backend Test Center</p>
        <button type="button" className="btn-pill" onClick={run} disabled={running}>
          {running ? "running…" : "run backend smoke"}
        </button>
      </div>

      {error && <p className="panel-error">{error}</p>}
      {!report && !error && <p className="panel-empty">Not run yet this session. Also available via `npm run smoke`.</p>}

      {report && (
        <>
          <p className={`smoke-summary ${report.failed > 0 ? "smoke-summary--bad" : "smoke-summary--ok"} mono`}>
            {report.passed}/{report.total} passed · ran {new Date(report.ranAt).toLocaleTimeString()}
          </p>
          {groups.map((group) => (
            <div key={group} className="smoke-group">
              <p className="smoke-group-title mono">{group}</p>
              {report.results
                .filter((r) => r.group === group)
                .map((r) => (
                  <div key={r.name} className="smoke-row">
                    <span className={`led-dot led-dot--${r.ok ? "on" : "bad"}`} />
                    <span className="smoke-row-name">{r.name}</span>
                    {r.detail && <span className="smoke-row-detail mono">{r.detail}</span>}
                  </div>
                ))}
            </div>
          ))}
          <p className="panel-empty">Full JSON report also written to smoke-report.local.json (git-ignored).</p>
        </>
      )}
    </div>
  );
}
