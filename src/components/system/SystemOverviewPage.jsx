import { useEffect, useMemo, useState } from "react";
import { useGateway } from "../../state/GatewayHealth.jsx";
import { useUsage } from "../../state/Usage.jsx";
import { useChat } from "../../state/Chat.jsx";
import { useViewMode } from "../../state/ViewMode.jsx";
import {
  fetchSystemStats,
  fetchMessagingPlatforms,
  fetchCronJobs,
  fetchHermesToolsets,
  fetchHermesMcpServers,
  fetchHermesProfiles,
  fetchHermesMemory,
} from "../../lib/hermesBridge.js";
import { GATEWAY_BASE_URL } from "../../config.js";
import { PageShell } from "../PageShell.jsx";
import { DiagnosticCard } from "../DiagnosticCard.jsx";
import { UsageRing } from "../UsageRing.jsx";
import { ActivityCenter } from "../activity/ActivityCenter.jsx";
import "./SystemOverviewPage.css";

const PLATFORM_LABELS = { telegram: "Telegram", discord: "Discord", whatsapp: "WhatsApp", slack: "Slack", signal: "Signal" };

function fmt(n) {
  if (n == null) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

function platformTone(state) {
  if (state === "connected") return "ok";
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

function relTime(iso) {
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return "—";
  const abs = Math.abs(ms);
  const s = Math.round(abs / 1000);
  const label = s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)}m` : s < 86400 ? `${Math.round(s / 3600)}h` : `${Math.round(s / 86400)}d`;
  return ms >= 0 ? `in ${label}` : `${label} ago`;
}

/* Chat updatedAt is a raw ms epoch (Date.now()-style), not an ISO
   string — always in the past, so this is simpler than relTime above. */
function relTimeAgo(tsMs) {
  const s = Math.round((Date.now() - tsMs) / 1000);
  if (s < 60) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

function memoryTone(status) {
  if (status === "ready") return "ok";
  if (status === "needs_config") return "warn";
  return "";
}

function SummaryTile({ label, value, sub, tone }) {
  return (
    <div className={`overview-tile${tone ? ` overview-tile--${tone}` : ""}`}>
      <span className="overview-tile-label mono">{label}</span>
      <span className="overview-tile-value">{value}</span>
      {sub && <span className="overview-tile-sub mono">{sub}</span>}
    </div>
  );
}

function gatewayStatusTone(status) {
  if (status === "online") return "ok";
  if (status === "unauthorized") return "warn";
  return "bad";
}

/*
  SystemOverviewPage — the real operational dashboard. Every number here
  comes from a live source (gateway health poll, dashboard bridge, or the
  chat/usage contexts already wired elsewhere) — sections render a
  DiagnosticCard instead of fake data when their source is unavailable.
*/
export function SystemOverviewPage() {
  const gateway = useGateway();
  const { openai, anthropic } = useUsage();
  const { chatList, activeId, runningChatId } = useChat();
  const { goTo } = useViewMode();

  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [platforms, setPlatforms] = useState(null);
  const [platformsError, setPlatformsError] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [jobsError, setJobsError] = useState(null);
  const [toolsets, setToolsets] = useState(null);
  const [mcpServers, setMcpServers] = useState(null);
  const [toolsError, setToolsError] = useState(null);
  const [profiles, setProfiles] = useState(null);
  const [profilesError, setProfilesError] = useState(null);
  const [memory, setMemory] = useState(null);
  const [memoryError, setMemoryError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [statsRes, platRes, jobsRes, toolsetsRes, mcpRes, profRes, memRes] = await Promise.allSettled([
        fetchSystemStats(),
        fetchMessagingPlatforms(),
        fetchCronJobs(),
        fetchHermesToolsets(),
        fetchHermesMcpServers(),
        fetchHermesProfiles(),
        fetchHermesMemory(),
      ]);
      if (!mounted) return;
      if (statsRes.status === "fulfilled") setStats(statsRes.value);
      else setStatsError(statsRes.reason?.message || "unavailable");
      if (platRes.status === "fulfilled") setPlatforms(platRes.value.platforms || []);
      else setPlatformsError(platRes.reason?.message || "unavailable");
      if (jobsRes.status === "fulfilled") setJobs(jobsRes.value || []);
      else setJobsError(jobsRes.reason?.message || "unavailable");
      if (toolsetsRes.status === "fulfilled") setToolsets(toolsetsRes.value?.data || []);
      else setToolsError((e) => e || toolsetsRes.reason?.message || "unavailable");
      if (mcpRes.status === "fulfilled") setMcpServers(mcpRes.value?.servers || []);
      else setToolsError((e) => e || mcpRes.reason?.message || "unavailable");
      if (profRes.status === "fulfilled") setProfiles(profRes.value?.profiles || []);
      else setProfilesError(profRes.reason?.message || "unavailable");
      if (memRes.status === "fulfilled") setMemory(memRes.value);
      else setMemoryError(memRes.reason?.message || "unavailable");
    }
    load();
    const timer = setInterval(load, 30000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const gatewayHost = GATEWAY_BASE_URL.replace(/^https?:\/\//, "");
  const enabledPlatforms = useMemo(() => (platforms || []).filter((p) => p.enabled), [platforms]);
  const activeProfile = profiles?.find((p) => p.is_default) || profiles?.[0];
  const recentChats = chatList.slice(0, 6);

  const jobStats = useMemo(() => {
    if (!jobs) return null;
    const enabled = jobs.filter((j) => j.enabled).length;
    const paused = jobs.filter((j) => !j.enabled).length;
    const failed = jobs.filter((j) => j.last_status === "error").length;
    const nextRun = jobs
      .filter((j) => j.enabled && j.next_run_at)
      .map((j) => j.next_run_at)
      .sort()[0];
    return { total: jobs.length, enabled, paused, failed, nextRun };
  }, [jobs]);

  const toolStats = useMemo(() => {
    if (!toolsets) return null;
    const enabled = toolsets.filter((t) => t.enabled).length;
    return { total: toolsets.length, enabled, disabled: toolsets.length - enabled };
  }, [toolsets]);

  const mcpStats = useMemo(() => {
    if (!mcpServers) return null;
    const connected = mcpServers.filter((s) => s.connected).length;
    const error = mcpServers.filter((s) => !s.connected && s.status === "error").length;
    return { total: mcpServers.length, connected, missing: mcpServers.length - connected - error, error };
  }, [mcpServers]);

  const memoryStats = useMemo(() => {
    if (!memory?.providers) return null;
    const ready = memory.providers.filter((p) => p.status === "ready").length;
    return { total: memory.providers.length, ready, active: memory.active || null };
  }, [memory]);

  return (
    <PageShell title="System">
      {/* ---- Gateway ---------------------------------------------------- */}
      <div className="panel-section">
        <p className="panel-section-title">Gateway</p>
        <div className="panel-card overview-gateway">
          <span className={`status-badge status-badge--${gatewayStatusTone(gateway.status)}`}>{gateway.status}</span>
          <div className="overview-gateway-meta mono">
            <span>{gatewayHost}</span>
            <span>{gateway.latencyMs != null ? `${gateway.latencyMs}ms` : "—"}</span>
            {gateway.detail?.version && <span>v{gateway.detail.version}</span>}
          </div>
          {gateway.status === "unauthorized" && (
            <p className="panel-error">Auth failing — check VITE_GATEWAY_API_KEY in .env.local.</p>
          )}
          {gateway.status === "unreachable" && <p className="panel-error">Gateway unreachable at {gatewayHost}.</p>}
        </div>
      </div>

      {/* ---- Activity (compact) --------------------------------------------- */}
      <ActivityCenter compact />

      {/* ---- Usage -------------------------------------------------------- */}
      <div className="panel-section">
        <p className="panel-section-title">Usage</p>
        <div className="panel-card overview-usage">
          <UsageRing
            size={116}
            tone="openai"
            pct={openai.pct}
            label="OPENAI · WK"
            value={`${fmt(openai.tokens)} tok`}
            sub={`of ${fmt(openai.budget)}`}
          />
          <UsageRing
            size={116}
            tone="anthropic"
            pct={anthropic.pctWeek}
            innerPct={anthropic.pct5h}
            label="CLAUDE"
            value={`${fmt(anthropic.tokens7d)} tok`}
            sub={anthropic.status === "error" ? "offline" : `5h ${fmt(anthropic.tokens5h)}`}
          />
        </div>
      </div>

      {/* ---- Machine + Platforms ------------------------------------------ */}
      <div className="panel-section overview-row">
        <div className="panel-card overview-col">
          <p className="panel-section-title">Machine</p>
          {statsError && !stats && <DiagnosticCard title="Machine stats unavailable" detail={statsError} hint="GET /api/system/stats via the dashboard bridge." />}
          {stats && (
            <div className="overview-tile-grid">
              <SummaryTile label="CPU" value={`${Math.round(stats.cpu_percent)}%`} />
              <SummaryTile label="MEM" value={`${Math.round(stats.memory?.percent ?? 0)}%`} />
              <SummaryTile label="DISK" value={`${Math.round(stats.disk?.percent ?? 0)}%`} />
              <SummaryTile label="UPTIME" value={formatUptime(stats.uptime_seconds)} />
            </div>
          )}
        </div>

        <div className="panel-card overview-col">
          <p className="panel-section-title">Platforms</p>
          {platformsError && !platforms && (
            <DiagnosticCard title="Platforms unavailable" detail={platformsError} hint="GET /api/messaging/platforms via the dashboard bridge." />
          )}
          {platforms && (
            <div className="overview-platforms">
              {enabledPlatforms.map((p) => (
                <span key={p.id} className="overview-platform mono" title={p.error_message || p.state}>
                  <span className={`led-dot led-dot--${platformTone(p.state)}${p.state === "connected" ? " led-dot--pulse" : ""}`} />
                  {PLATFORM_LABELS[p.id] || p.name}
                </span>
              ))}
              {enabledPlatforms.length === 0 && <span className="panel-empty">No platforms enabled.</span>}
            </div>
          )}
        </div>
      </div>

      {/* ---- Jobs / Tools / MCP / Model summaries -------------------------- */}
      <div className="panel-section overview-row">
        <button type="button" className="panel-card glass-card--interactive overview-col overview-summary" onClick={() => goTo("jobs")}>
          <p className="panel-section-title">Jobs</p>
          {jobsError && !jobs && <DiagnosticCard title="Jobs unavailable" detail={jobsError} hint="GET /api/cron/jobs via the dashboard bridge." />}
          {jobStats && (
            <div className="overview-tile-grid">
              <SummaryTile label="ENABLED" value={jobStats.enabled} tone="ok" />
              <SummaryTile label="PAUSED" value={jobStats.paused} />
              <SummaryTile label="FAILED" value={jobStats.failed} tone={jobStats.failed > 0 ? "bad" : ""} />
              <SummaryTile label="NEXT" value={relTime(jobStats.nextRun)} />
            </div>
          )}
        </button>

        <button type="button" className="panel-card glass-card--interactive overview-col overview-summary" onClick={() => goTo("tools")}>
          <p className="panel-section-title">Tools / MCP</p>
          {toolsError && !toolsets && !mcpServers && (
            <DiagnosticCard title="Tools unavailable" detail={toolsError} hint="GET /v1/toolsets (gateway) and /api/mcp/servers (dashboard)." />
          )}
          <div className="overview-tile-grid">
            {toolStats && <SummaryTile label="TOOLSETS" value={`${toolStats.enabled}/${toolStats.total}`} sub="enabled" />}
            {mcpStats && (
              <SummaryTile
                label="MCP"
                value={mcpStats.total === 0 ? "0" : `${mcpStats.connected}/${mcpStats.total}`}
                sub={mcpStats.total === 0 ? "none configured" : "connected"}
              />
            )}
          </div>
        </button>
      </div>

      <div className="panel-section overview-row">
        <button type="button" className="panel-card glass-card--interactive overview-col overview-summary" onClick={() => goTo("hermes")}>
          <p className="panel-section-title">Model / Profile</p>
          {profilesError && !profiles && <DiagnosticCard title="Profile unavailable" detail={profilesError} hint="GET /api/profiles via the dashboard bridge." />}
          {activeProfile && (
            <div className="overview-profile">
              <span className="overview-profile-name">{activeProfile.name}</span>
              <span className="overview-profile-model mono">
                {activeProfile.provider} / {activeProfile.model}
              </span>
              <span className="overview-profile-meta mono">{activeProfile.skill_count} skills · {activeProfile.gateway_running ? "gateway running" : "gateway stopped"}</span>
            </div>
          )}
        </button>

        <button type="button" className="panel-card glass-card--interactive overview-col overview-summary" onClick={() => goTo("hermes")}>
          <p className="panel-section-title">Memory</p>
          {memoryError && !memory && <DiagnosticCard title="Memory unavailable" detail={memoryError} hint="GET /api/memory via the dashboard bridge." />}
          {memoryStats && (
            <div className="overview-tile-grid">
              <SummaryTile label="READY" value={`${memoryStats.ready}/${memoryStats.total}`} tone={memoryStats.ready > 0 ? "ok" : ""} />
              <SummaryTile label="ACTIVE" value={memoryStats.active || "—"} />
            </div>
          )}
        </button>
      </div>

      {/* ---- Sessions ----------------------------------------------------- */}
      <div className="panel-section">
        <div className="overview-section-head">
          <p className="panel-section-title" style={{ marginBottom: 0 }}>
            Recent sessions
          </p>
          <button type="button" className="btn-pill" onClick={() => goTo("chat")}>
            open chat →
          </button>
        </div>
        <div className="overview-sessions">
          {recentChats.map((c) => {
            const isActive = c.id === activeId;
            const isLive = c.id === runningChatId;
            return (
              <div key={c.id} className={`panel-card overview-session${isActive ? " overview-session--active" : ""}`}>
                <span className={`led-dot${isLive ? " led-dot--on led-dot--pulse" : isActive ? " led-dot--on" : ""}`} />
                <span className="overview-session-title">{c.title}</span>
                <span className="overview-session-meta mono">{c.empty ? "empty" : relTimeAgo(c.updatedAt)}</span>
              </div>
            );
          })}
          {recentChats.length === 0 && <p className="panel-empty">No chats yet.</p>}
        </div>
      </div>

      {/* ---- Activity (full, filterable) ------------------------------------ */}
      <ActivityCenter />
    </PageShell>
  );
}
