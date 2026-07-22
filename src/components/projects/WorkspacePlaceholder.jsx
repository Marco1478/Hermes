/*
  WorkspacePlaceholder — an honest "not built yet" state for workspace
  tabs whose real content lands in a later instruction chunk. Never a fake
  empty-but-functional-looking panel.
*/
export function WorkspacePlaceholder({ title, chunk, detail }) {
  return (
    <div className="panel-section">
      <p className="panel-section-title">{title}</p>
      <div className="diagnostic-card panel-card">
        <div className="diagnostic-card-head">
          <span className="tag-badge">{chunk}</span>
          <span className="diagnostic-card-title">Not built yet</span>
        </div>
        <p className="diagnostic-card-detail">{detail}</p>
      </div>
    </div>
  );
}
