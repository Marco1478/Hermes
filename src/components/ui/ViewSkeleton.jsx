import "./ViewSkeleton.css";

/*
  ViewSkeleton — the Suspense fallback for lazy-loaded views (see
  App.jsx). A glass panel with pulsing placeholder bars instead of a
  blank screen or raw "Loading…" text — the chunk is genuinely being
  fetched over the network on first visit to that section, so this is
  a real loading state, not decoration.
*/
export function ViewSkeleton() {
  return (
    <div className="view-skeleton">
      <div className="view-skeleton-panel glass-panel">
        <div className="view-skeleton-bar view-skeleton-bar--title" />
        <div className="view-skeleton-bar" />
        <div className="view-skeleton-bar" />
        <div className="view-skeleton-bar view-skeleton-bar--short" />
      </div>
      <div className="view-skeleton-panel glass-panel">
        <div className="view-skeleton-bar view-skeleton-bar--title" />
        <div className="view-skeleton-bar" />
        <div className="view-skeleton-bar view-skeleton-bar--short" />
      </div>
    </div>
  );
}
