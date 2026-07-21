import { PageShell } from "../PageShell.jsx";
import "./SystemOverviewPage.css";

/*
  SystemOverviewPage — the real operational dashboard, reached from
  BrandMark when already on the hero (see BrandMark.jsx). Wired up here
  as a real tab first (CLAUDE-001); the rich content lands next.
*/
export function SystemOverviewPage() {
  return (
    <PageShell title="System">
      <div className="panel-section">
        <p className="panel-section-title">Overview</p>
        <p className="panel-empty">Loading system overview…</p>
      </div>
    </PageShell>
  );
}
