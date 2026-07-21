import { useEffect, useState } from "react";
import { useUsage } from "../../state/Usage.jsx";
import { useChat } from "../../state/Chat.jsx";
import { useViewMode } from "../../state/ViewMode.jsx";
import { fetchSystemStats, fetchMessagingPlatforms } from "../../lib/hermesBridge.js";
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

/* A single SVG usage ring. `pct` in [0,1]; optional `innerPct` draws a
   second, inner ring (the "5-hour crown") inside the main one. */
function Ring({ pct, innerPct, label, value, sub, tone }) {
  const size = 84;
  const c = size / 2;
  const rOuter = 36;
  const rInner = 28;
  const circOuter = 2 * Math.PI * rOuter;
  const circInner = 2 * Math.PI * rInner;
  const pctText = `${Math.round(pct * 100)}%`;

  return (
    <div className={`orb orb--${tone}`}>
      <svg className="orb-svg" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${pctText}`}>
        <circle className="orb-track" cx={c} cy={c} r={rOuter} strokeWidth="5" fill="none" />
        {innerPct != null && <circle className="orb-track" cx={c} cy={c} r={rInner} strokeWidth="4" fill="none" />}
        <circle
          className="orb-arc orb-arc--outer"
          cx={c}
          cy={c}
          r={rOuter}
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circOuter}
          strokeDashoffset={circOuter * (1 - pct)}
          transform={`rotate(-90 ${c} ${c})`}
        />
        {innerPct != null && (
          <circle
            className="orb-arc orb-arc--inner"
            cx={c}
            cy={c}
            r={rInner}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circInner}
            strokeDashoffset={circInner * (1 - innerPct)}
            transform={`rotate(-90 ${c} ${c})`}
          />
        )}
      </svg>
      <div className="orb-center">
        <span className="orb-pct">{pctText}</span>
        <span className="orb-value mono">{value}</span>
      </div>
      <div className="orb-caption">
        <span className="orb-label mono">{label}</span>
        {sub && <span className="orb-sub mono">{sub}</span>}
      </div>
    </div>
  );
}

/*
  HeroSidebar — the left column of the hero: three glass cards (usage,
  system, sessions) distributed across the full height instead of a
  cluster of floating text at the top. Replaces the old UsageOrbs +
  SystemPanel overlay pair; same data sources, one coherent surface.
*/
export function HeroSidebar() {
  const { openai, anthropic } = useUsage();
  const { chatList, activeId, runningChatId, switchChat } = useChat();
  const { enterChat } = useViewMode();
  const [stats, setStats] = useState(null);
  const [platforms, setPlatforms] = useState(null);

  useEffect(() => {
    let mounted = true;
    let timer = null;
    async function poll() {
      const [statsRes, platRes] = await Promise.allSettled([fetchSystemStats(), fetchMessagingPlatforms()]);
      if (!mounted) return;
      if (statsRes.status === "fulfilled") setStats(statsRes.value);
      if (platRes.status === "fulfilled") setPlatforms(platRes.value.platforms || []);
      timer = setTimeout(poll, POLL_MS);
    }
    poll();
    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const recentChats = chatList.slice(0, 5);

  return (
    <div className="hero-sidebar">
      <div className="glass-card hero-card hero-card--usage">
        <p className="panel-section-title hero-card-title">Usage</p>
        <div className="usage-orbs">
          <Ring
            tone="openai"
            pct={openai.pct}
            label="OPENAI · WK"
            value={`${fmt(openai.tokens)} tok`}
            sub={`of ${fmt(openai.budget)}`}
          />
          <Ring
            tone="anthropic"
            pct={anthropic.pctWeek}
            innerPct={anthropic.pct5h}
            label="CLAUDE"
            value={`${fmt(anthropic.tokens7d)} tok`}
            sub={anthropic.status === "error" ? "offline" : `5h ${fmt(anthropic.tokens5h)}`}
          />
        </div>
      </div>

      {(stats || platforms) && (
        <div className="glass-card hero-card hero-card--system">
          <p className="panel-section-title hero-card-title">System</p>
          {stats && (
            <div className="hero-system-row mono">
              <span className="hero-system-item">
                <span className="hero-system-label">CPU</span>
                <span className="hero-system-value">{Math.round(stats.cpu_percent)}%</span>
              </span>
              <span className="hero-system-item">
                <span className="hero-system-label">MEM</span>
                <span className="hero-system-value">{Math.round(stats.memory?.percent ?? 0)}%</span>
              </span>
              <span className="hero-system-item">
                <span className="hero-system-label">DISK</span>
                <span className="hero-system-value">{Math.round(stats.disk?.percent ?? 0)}%</span>
              </span>
              <span className="hero-system-item">
                <span className="hero-system-label">UP</span>
                <span className="hero-system-value">{formatUptime(stats.uptime_seconds)}</span>
              </span>
            </div>
          )}
          {platforms && platforms.length > 0 && (
            <div className="hero-platforms">
              {platforms
                .filter((p) => p.enabled)
                .map((p) => (
                  <span key={p.id} className="hero-platform mono" title={p.error_message || p.state}>
                    <span className={`led-dot led-dot--${platformTone(p.state)}${p.state === "connected" ? " led-dot--pulse" : ""}`} />
                    {PLATFORM_LABELS[p.id] || p.name}
                  </span>
                ))}
            </div>
          )}
        </div>
      )}

      <div className="glass-card hero-card hero-card--sessions">
        <p className="panel-section-title hero-card-title">Sessions</p>
        <ul className="hero-sessions-list">
          {recentChats.map((c) => {
            const isActive = c.id === activeId;
            const isLive = c.id === runningChatId;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className={`hero-session-row${isActive ? " hero-session-row--active" : ""}`}
                  onClick={() => {
                    switchChat(c.id);
                    enterChat();
                  }}
                >
                  <span className={`led-dot${isLive ? " led-dot--on led-dot--pulse" : isActive ? " led-dot--on" : ""}`} />
                  <span className="hero-session-title">{c.title}</span>
                  <span className="hero-session-meta mono">{c.empty ? "empty" : relTime(c.updatedAt)}</span>
                </button>
              </li>
            );
          })}
          {recentChats.length === 0 && <li className="hero-session-empty mono">No chats yet.</li>}
        </ul>
      </div>
    </div>
  );
}
