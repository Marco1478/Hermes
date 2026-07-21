import { useEffect, useState } from "react";
import { fetchHermesToolsets, fetchHermesMcpServers } from "../../lib/hermesBridge.js";
import { PageShell } from "../PageShell.jsx";
import "./ToolsPage.css";

function ToolsetCard({ ts }) {
  return (
    <div className="panel-card toolset-card">
      <div className="toolset-head">
        <span className="toolset-label">{ts.label || ts.name}</span>
        <span className={`toolset-badge mono${ts.enabled ? " toolset-badge--on" : ""}`}>
          {ts.enabled ? "enabled" : "disabled"}
        </span>
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

/*
  ToolsPage — the shared setup surface for toolsets (gateway /v1/toolsets)
  and MCP servers (dashboard /api/mcp/servers). Read-only for now: the
  write endpoints exist on the real box but haven't been verified live,
  and this is a live agent's config — better to show truth than guess at
  a request body that could break it.
*/
export function ToolsPage() {
  const [toolsets, setToolsets] = useState(null);
  const [mcpServers, setMcpServers] = useState(null);
  const [error, setError] = useState(null);

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

  return (
    <PageShell title="Tools">
      {error && <p className="panel-error">{error}</p>}

      <div className="panel-section">
        <p className="panel-section-title">Toolsets</p>
        {!toolsets && !error && <p className="panel-empty">Loading…</p>}
        {toolsets && toolsets.length === 0 && <p className="panel-empty">No toolsets reported.</p>}
        <div className="toolset-grid">
          {toolsets?.map((ts) => (
            <ToolsetCard key={ts.name} ts={ts} />
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
            <div key={s.name || s.id} className="panel-card toolset-card">
              <div className="toolset-head">
                <span className="toolset-label">{s.name || s.id}</span>
                <span className={`toolset-badge mono${s.connected ? " toolset-badge--on" : ""}`}>
                  {s.connected ? "connected" : s.status || "unknown"}
                </span>
              </div>
              {s.url && <p className="toolset-desc mono">{s.url}</p>}
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
