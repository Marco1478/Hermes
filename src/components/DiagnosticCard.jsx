/*
  DiagnosticCard — what an empty/failed data section shows instead of a
  bare error string or blank space. Names the missing piece (dashboard
  bridge, gateway, a specific env var) so the page still reads as
  intentional, not broken.
*/
export function DiagnosticCard({ title, detail, hint, tone = "warn" }) {
  return (
    <div className="panel-card diagnostic-card">
      <div className="diagnostic-card-head">
        <span className={`led-dot led-dot--${tone}`} />
        <span className="diagnostic-card-title">{title}</span>
      </div>
      {detail && <p className="diagnostic-card-detail">{detail}</p>}
      {hint && <p className="diagnostic-card-hint mono">{hint}</p>}
    </div>
  );
}
