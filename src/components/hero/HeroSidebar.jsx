import { useEffect, useMemo, useState } from "react";
import { useUsage } from "../../state/Usage.jsx";
import { useChat } from "../../state/Chat.jsx";
import { useViewMode } from "../../state/ViewMode.jsx";
import { useGateway } from "../../state/GatewayHealth.jsx";
import { fetchSystemStats, fetchMessagingPlatforms } from "../../lib/hermesBridge.js";
import { GATEWAY_BASE_URL } from "../../config.js";
import "./HeroSidebar.css";

const POLL_MS = 30000;
const PLATFORM_LABELS = { telegram: "Telegram", discord: "Discord", whatsapp: "WhatsApp", slack: "Slack", signal: "Signal" };

function fmt(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return String(n ?? 0);
}

function platformTone(state) {
  if (state === "connected") return "on";
  if (state === "connecting" || state === "retrying") return "warn";
  if (state === "fatal" || state === "error") return "bad";
  return "";
}

function formatUptime(seconds) {
  if (!seconds) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function relTime(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

function pctLabel(value) {
  return `${Math.round((value || 0) * 100)}%`;
}

function MetricTile({ label, value, sub, tone = "" }) {
  return (
    <div className={`control-metric${tone ? ` control-metric--${tone}` : ""}`}>
      <span className="control-metric-label mono">{label}</span>
      <span className="control-metric-value">{value}</span>
      {sub && <span className="control-metric-sub mono">{sub}</span>}
    </div>
  );
}

/*
  HeroSidebar — now a real control-center deck. The previous implementation
  scattered usage, system and sessions as three floating cards; this wraps
  them into one readable command surface with clear groups and hierarchy.
*/
export function HeroSidebar() {
  const { openai, anthropic } = useUsage();
  const { chatList, activeId, runningChatId, switchChat } = useChat();
  const { enterChat, goTo } = useViewMode();
  const gateway = useGateway();
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [platforms, setPlatforms] = useState(null);
  const [platformsError, setPlatformsError] = useState(null);

  useEffect(() => {
    let mounted = true;
    let timer = null;
    async function poll() {
      const [statsRes, platRes] = await Promise.allSettled([fetchSystemStats(), fetchMessagingPlatforms()]);
      if (!mounted) return;
      if (statsRes.status === "fulfilled") {
        setStats(statsRes.value);
        setStatsError(null);
      } else {
        setStatsError(statsRes.reason?.message || "unavailable");
      }
      if (platRes.status === "fulfilled") {
        setPlatforms(platRes.value.platforms || []);
        setPlatformsError(null);
      } else {
        setPlatformsError(platRes.reason?.message || "unavailable");
      }
      timer = setTimeout(poll, POLL_MS);
    }
    poll();
    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const recentChats = chatList.slice(0, 4);
  const enabledPlatforms = useMemo(() => (platforms || []).filter((p) => p.enabled), [platforms]);
  const gatewayHost = GATEWAY_BASE_URL.replace(/^https?:\/\//, "");

  return (
    <aside className="control-center" aria-label="Hermes control center">
      <div className="control-center-head">
        <div>
          <p className="control-eyebrow mono">CONTROL CENTER</p>
          <h2 className="control-title">System overview</h2>
        </div>
        <span className={`status-badge status-badge--${gateway.status === "online" ? "ok" : gateway.status === "unauthorized" ? "warn" : "bad"}`}>
          {gateway.status}
        </span>
      </div>

      <div className="control-strip mono" title={gatewayHost}>
        <span className={`led-dot led-dot--${gateway.status === "online" ? "on" : gateway.status === "unauthorized" ? "warn" : "bad"}`} />
        <span>Gateway</span>
        <strong>{gateway.latencyMs != null ? `${gateway.latencyMs}ms` : gatewayHost}</strong>
      </div>

      <section className="control-section">
        <div className="control-section-head">
          <p className="panel-section-title">Usage</p>
          <button type="button" className="control-link mono" onClick={() => goTo("hermes")}>details →</button>
        </div>
        <div className="control-metric-grid control-metric-grid--usage">
          <MetricTile label="OpenAI week" value={pctLabel(openai.pct)} sub={`${fmt(openai.tokens)} / ${fmt(openai.budget)} tok`} tone="blue" />
          <MetricTile label="Claude week" value={pctLabel(anthropic.pctWeek)} sub={`${fmt(anthropic.tokens7d)} tok · 5h ${fmt(anthropic.tokens5h)}`} tone="warm" />
        </div>
      </section>

      <section className="control-section">
        <div className="control-section-head">
          <p className="panel-section-title">Machine</p>
          {!stats && (
            <span className="control-muted mono" title={statsError || undefined}>
              {statsError ? "unreachable" : "loading…"}
            </span>
          )}
        </div>
        <div className="control-metric-grid">
          <MetricTile label="CPU" value={stats ? `${Math.round(stats.cpu_percent)}%` : "—"} />
          <MetricTile label="MEM" value={stats ? `${Math.round(stats.memory?.percent ?? 0)}%` : "—"} />
          <MetricTile label="DISK" value={stats ? `${Math.round(stats.disk?.percent ?? 0)}%` : "—"} />
          <MetricTile label="UPTIME" value={stats ? formatUptime(stats.uptime_seconds) : "—"} />
        </div>
      </section>

      <section className="control-section">
        <div className="control-section-head">
          <p className="panel-section-title">Platforms</p>
          <button type="button" className="control-link mono" onClick={() => goTo("tools")}>tools →</button>
        </div>
        <div className="control-platforms">
          {enabledPlatforms.length > 0 ? (
            enabledPlatforms.map((p) => (
              <span key={p.id} className="control-platform mono" title={p.error_message || p.state}>
                <span className={`led-dot led-dot--${platformTone(p.state)}${p.state === "connected" ? " led-dot--pulse" : ""}`} />
                {PLATFORM_LABELS[p.id] || p.name}
              </span>
            ))
          ) : platformsError ? (
            <span className="control-muted mono" title={platformsError}>
              Dashboard bridge unreachable
            </span>
          ) : platforms === null ? (
            <span className="control-muted mono">loading…</span>
          ) : (
            <span className="control-muted mono">No platforms enabled</span>
          )}
        </div>
      </section>

      <section className="control-section control-section--sessions">
        <div className="control-section-head">
          <p className="panel-section-title">Recent sessions</p>
          <button type="button" className="control-link mono" onClick={enterChat}>chat →</button>
        </div>
        <ul className="control-sessions-list">
          {recentChats.map((c) => {
            const isActive = c.id === activeId;
            const isLive = c.id === runningChatId;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className={`control-session-row${isActive ? " control-session-row--active" : ""}`}
                  onClick={() => {
                    switchChat(c.id);
                    enterChat();
                  }}
                >
                  <span className={`led-dot${isLive ? " led-dot--on led-dot--pulse" : isActive ? " led-dot--on" : ""}`} />
                  <span className="control-session-title">{c.title}</span>
                  <span className="control-session-meta mono">{c.empty ? "empty" : relTime(c.updatedAt)}</span>
                </button>
              </li>
            );
          })}
          {recentChats.length === 0 && <li className="control-session-empty mono">No chats yet.</li>}
        </ul>
      </section>
    </aside>
  );
}
