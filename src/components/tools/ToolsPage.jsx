import { useCallback, useEffect, useState } from "react";
import { fetchHermesToolsets, fetchHermesMcpServers, toggleToolset, toggleMcpServer } from "../../lib/hermesBridge.js";
import { PageShell } from "../PageShell.jsx";
import { DiagnosticCard } from "../DiagnosticCard.jsx";
import "./ToolsPage.css";

function ToolsetCard({ ts, onToggle, busy }) {
  return (
    <div className="panel-card toolset-card">
      <div className="toolset-head">
        <span className="toolset-label">{ts.label || ts.name}</span>
        <label className="toggle-switch" title={ts.enabled ? "Disable toolset" : "Enable toolset"}>
          <input type="checkbox" checked={ts.enabled} disabled={busy} onChange={() => onToggle(ts)} />
          <span className="toggle-switch-track" />
        </label>
      </div>
      {ts.description && <p className="toolset-desc">{ts.description}</p>}
      {ts.tools?.length > 0 && (
        <div className="toolset-tools mono">
          {ts.tools.map((t) => (
            <span key={t} className="toolset-tool">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function McpCard({ s, onToggle, busy }) {
  const name = s.name || s.id;
  return (
    <div className="panel-card toolset-card">
      <div className="toolset-head">
        <span className="toolset-label">{name}</span>
        <label className="toggle-switch" title={s.enabled === false ? "Enable server" : "Disable server"}>
          <input type="checkbox" checked={s.enabled !== false} disabled={busy} onChange={() => onToggle(s)} />
          <span className="toggle-switch-track" />
        </label>
      </div>
      <span className={`toolset-badge mono${s.connected ? " toolset-badge--on" : ""}`}>
        {s.connected ? "connected" : s.status || "unknown"}
      </span>
      {s.url && <p className="toolset-desc mono">{s.url}</p>}
    </div>
  );
}

/*
  ToolsPage — the shared setup surface for toolsets (gateway /v1/toolsets)
  and MCP servers (dashboard /api/mcp/servers). Enable/disable toggles hit
  real verified endpoints (PUT /api/tools/toolsets/{name} and PUT
  /api/mcp/servers/{name}/enabled — web_server.py's ToolsetToggle /
  MCPEnabledToggle models). No MCP servers are configured on the box yet,
  so that toggle has nothing to act on until Marco adds one via the CLI —
  the control is real, just currently empty.
*/
export function ToolsPage() {
  const [toolsets, setToolsets] = useState(null);
  const [mcpServers, setMcpServers] = useState(null);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busyName, setBusyName] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [tsRes, mcpRes] = await Promise.allSettled([fetchHermesToolsets(), fetchHermesMcpServers()]);
      if (!mounted) return;
      if (tsRes.status === "fulfilled") setToolsets(tsRes.value?.data || []);
      if (mcpRes.status === "fulfilled") setMcpServers(mcpRes.value?.servers || []);
      if (tsRes.status === "rejected" && mcpRes.status === "rejected") {
        setError(tsRes.reason?.message || "Could not load tools.");
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const onToggleToolset = useCallback(async (ts) => {
    setBusyName(ts.name);
    setActionError(null);
    const next = !ts.enabled;
    setToolsets((prev) => prev.map((t) => (t.name === ts.name ? { ...t, enabled: next } : t)));
    try {
      await toggleToolset(ts.name, next);
    } catch (err) {
      setToolsets((prev) => prev.map((t) => (t.name === ts.name ? { ...t, enabled: ts.enabled } : t)));
      setActionError(err.message || String(err));
    } finally {
      setBusyName(null);
    }
  }, []);

  const onToggleMcp = useCallback(async (s) => {
    const name = s.name || s.id;
    setBusyName(name);
    setActionError(null);
    const next = !(s.enabled !== false);
    setMcpServers((prev) => prev.map((m) => (m.name === name ? { ...m, enabled: next } : m)));
    try {
      await toggleMcpServer(name, next);
    } catch (err) {
      setMcpServers((prev) => prev.map((m) => (m.name === name ? { ...m, enabled: s.enabled } : m)));
      setActionError(err.message || String(err));
    } finally {
      setBusyName(null);
    }
  }, []);

  return (
    <PageShell title="Tools">
      {error && (
        <DiagnosticCard
          title="Tools unavailable"
          detail={error}
          hint="Toolsets come from the gateway (:8642), MCP servers from the dashboard (:9119) — check VITE_GATEWAY_* and HERMES_DASHBOARD_* in .env.local."
        />
      )}
      {actionError && <p className="panel-error">{actionError}</p>}

      <div className="panel-section">
        <p className="panel-section-title">Toolsets</p>
        <p className="toolset-note mono">Changes save immediately but the running gateway caches its toolset list — restart it (Hermes tab) to pick them up.</p>
        {!toolsets && !error && <p className="panel-empty">Loading…</p>}
        {toolsets && toolsets.length === 0 && <p className="panel-empty">No toolsets reported.</p>}
        <div className="toolset-grid">
          {toolsets?.map((ts) => (
            <ToolsetCard key={ts.name} ts={ts} onToggle={onToggleToolset} busy={busyName === ts.name} />
          ))}
        </div>
      </div>

      <div className="panel-section">
        <p className="panel-section-title">MCP servers</p>
        {!mcpServers && !error && <p className="panel-empty">Loading…</p>}
        {mcpServers && mcpServers.length === 0 && (
          <p className="panel-empty">No MCP servers configured yet.</p>
        )}
        <div className="toolset-grid">
          {mcpServers?.map((s) => (
            <McpCard key={s.name || s.id} s={s} onToggle={onToggleMcp} busy={busyName === (s.name || s.id)} />
          ))}
        </div>
      </div>
    </PageShell>
  );
}
