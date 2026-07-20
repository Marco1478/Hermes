import { useEffect, useRef } from "react";
import { useGateway } from "../../state/GatewayHealth.jsx";
import "./StatusPanel.css";

const PLATFORM_LABELS = {
  telegram: "Telegram",
  discord: "Discord",
  whatsapp: "WhatsApp",
  api_server: "API / this UI",
};

function platformTone(state) {
  if (state === "connected") return "ok";
  if (state === "retrying") return "warn";
  if (state === "fatal" || state === "error") return "bad";
  return "dim";
}

function relTime(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  const s = Math.round(ms / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

function bytesToGB(n) {
  return (n / 1024 ** 3).toFixed(1);
}

/*
  StatusPanel — "Stato Hermes": what the small HUD dot only hints at,
  expanded. Everything here comes straight from the gateway's real
  /health/detailed body (see hooks/useGatewayHealth.js's `detail`) —
  platforms, disk, active agents, readiness checks. Nothing simulated;
  if the gateway hasn't returned a body yet, the panel says so instead of
  inventing placeholder numbers.
*/
export function StatusPanel({ open, onClose, anchorRef }) {
  const { status: gatewayStatus, latencyMs: gatewayLatency, detail } = useGateway();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target) && !anchorRef.current?.contains(e.target)) {
        onClose();
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  const platforms = detail?.platforms ? Object.entries(detail.platforms) : [];
  const disk = detail?.readiness?.checks?.disk;
  const queues = detail?.readiness?.checks?.background_queues;

  return (
    <div className="status-panel" ref={panelRef} role="dialog" aria-label="Hermes status">
      <div className="status-panel-head">
        <span className={`chat-status-dot chat-status-dot--${gatewayStatus}`} />
        <span className="status-panel-title mono">
          gateway {gatewayStatus}
          {gatewayStatus === "online" && gatewayLatency != null ? ` · ${gatewayLatency}ms` : ""}
        </span>
        {detail?.version && <span className="status-panel-version mono">v{detail.version}</span>}
      </div>

      {!detail ? (
        <p className="status-panel-empty mono">
          {gatewayStatus === "online" ? "Waiting for the next health poll…" : "No detail — gateway isn't reachable."}
        </p>
      ) : (
        <>
          <div className="status-section">
            <p className="status-section-title mono">PLATFORMS</p>
            <ul className="status-platform-list">
              {platforms.map(([id, p]) => (
                <li key={id} className="status-platform">
                  <span className={`status-dot status-dot--${platformTone(p.state)}`} />
                  <span className="status-platform-name">{PLATFORM_LABELS[id] || id}</span>
                  <span className="status-platform-state mono">{p.state}</span>
                  {p.error_message && <span className="status-platform-err">{p.error_message}</span>}
                </li>
              ))}
              {platforms.length === 0 && <li className="status-platform-empty mono">No platform data.</li>}
            </ul>
          </div>

          <div className="status-section status-grid">
            <div className="status-metric">
              <span className="status-metric-label mono">ACTIVE AGENTS</span>
              <span className="status-metric-value">{detail.active_agents ?? "—"}</span>
            </div>
            <div className="status-metric">
              <span className="status-metric-label mono">GATEWAY</span>
              <span className="status-metric-value">{detail.gateway_busy ? "busy" : "idle"}</span>
            </div>
            {disk && (
              <div className="status-metric">
                <span className="status-metric-label mono">DISK USED</span>
                <span className="status-metric-value">
                  {disk.used_percent}%
                  {disk.free_bytes != null && <span className="status-metric-sub"> · {bytesToGB(disk.free_bytes)}GB free</span>}
                </span>
              </div>
            )}
            {queues && (
              <div className="status-metric">
                <span className="status-metric-label mono">API RUNS</span>
                <span className="status-metric-value">{queues.active_api_runs ?? 0} active</span>
              </div>
            )}
          </div>

          {detail.updated_at && (
            <p className="status-panel-updated mono">updated {relTime(detail.updated_at)}</p>
          )}
        </>
      )}
    </div>
  );
}
