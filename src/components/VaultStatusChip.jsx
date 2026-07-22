/*
  VaultStatusChip — shared by Notes/Projects (and System Overview): says
  plainly which persistence mode is actually active instead of letting
  local-cache-fallback look identical to a real connected vault.
*/
const LABEL = {
  unknown: "checking vault…",
  checking: "checking vault…",
  connected: "vault connected",
  not_configured: "vault not configured — using local cache",
  error: "vault error — using local cache",
};

const TONE = {
  connected: "ok",
  not_configured: "warn",
  error: "bad",
};

// .led-dot's own "lit" modifier is --on (see PageShell.css), not --ok — every
// other led-dot in the app uses that pairing already (ActivityCenter,
// SystemOverviewPage, HermesPage). Chip tone and dot tone are named
// differently on purpose, so they can't just share TONE above.
const DOT_TONE = {
  connected: "on",
  not_configured: "warn",
  error: "bad",
};

export function VaultStatusChip({ status, error }) {
  return (
    <div className={`vault-status-chip vault-status-chip--${TONE[status] || ""}`} title={status === "error" ? error || "" : undefined}>
      <span className={`led-dot led-dot--${DOT_TONE[status] || ""}`} />
      <span className="mono">{LABEL[status] || "vault status unknown"}</span>
    </div>
  );
}
