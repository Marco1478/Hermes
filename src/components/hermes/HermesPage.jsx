import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchHermesProfiles,
  fetchProfileSoul,
  saveProfileSoul,
  restartGateway,
  fetchSkillsFull,
  toggleSkill,
  fetchHermesMemory,
  fetchHermesLearningGraph,
} from "../../lib/hermesBridge.js";
import { fetchPluginsStatus, fetchPluginsList, enablePlugin, disablePlugin } from "../../lib/pluginsBridge.js";
import { PageShell } from "../PageShell.jsx";
import { DiagnosticCard } from "../DiagnosticCard.jsx";
import { MemoryGraph } from "./MemoryGraph.jsx";
import { MemoryEntryCards } from "./MemoryEntryCards.jsx";
import { MemoryDetailDrawer } from "./MemoryDetailDrawer.jsx";
import { MemoryStudio } from "../memory/MemoryStudio.jsx";
import "./HermesPage.css";

function memoryTone(status) {
  if (status === "ready") return "ok";
  if (status === "needs_config") return "warn";
  return "dim";
}

function SoulEditor({ profileName }) {
  const [content, setContent] = useState("");
  const [original, setOriginal] = useState("");
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    setStatus("loading");
    fetchProfileSoul(profileName)
      .then((d) => {
        if (!mounted) return;
        setContent(d.content || "");
        setOriginal(d.content || "");
        setStatus("ready");
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || String(err));
        setStatus("error");
      });
    return () => {
      mounted = false;
    };
  }, [profileName]);

  const dirty = content !== original;

  const onSave = useCallback(async () => {
    setStatus("saving");
    setError(null);
    try {
      await saveProfileSoul(profileName, content);
      setOriginal(content);
      setStatus("saved");
      setTimeout(() => setStatus("ready"), 1600);
    } catch (err) {
      setError(err.message || String(err));
      setStatus("error");
    }
  }, [profileName, content]);

  if (status === "loading") return <p className="panel-empty">Loading SOUL.md…</p>;

  return (
    <div className="soul-editor">
      <textarea
        className="soul-textarea mono"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        spellCheck="false"
        placeholder="SOUL.md unavailable from the dashboard bridge. If the file is full in Hermes, check the profile/path exposed by the bridge."
      />
      <div className="soul-editor-bar">
        {error && <span className="panel-error">{error}</span>}
        {status === "saved" && <span className="soul-saved mono">saved</span>}
        {dirty && status !== "saving" && status !== "saved" && <span className="soul-dirty mono">unsaved changes</span>}
        <button type="button" className="btn-pill" disabled={!dirty || status === "saving"} onClick={onSave}>
          {status === "saving" ? "saving…" : "save"}
        </button>
      </div>
    </div>
  );
}

function SkillCard({ skill, onToggle, busy }) {
  return (
    <div className="glass-card skill-card">
      <div className="skill-card-head">
        <span className={`led-dot${skill.enabled ? " led-dot--on led-dot--pulse" : ""}`} title={skill.enabled ? "active" : "disabled"} />
        <span className="skill-name mono">{skill.name}</span>
        <label className="toggle-switch skill-toggle" title={skill.enabled ? "Disable skill" : "Enable skill"}>
          <input type="checkbox" checked={skill.enabled} disabled={busy} onChange={() => onToggle(skill)} />
          <span className="toggle-switch-track" />
        </label>
      </div>
      {skill.category && <span className="tag-badge">{skill.category}</span>}
      <p className="skill-desc">{skill.description}</p>
      {skill.usage != null && <span className="skill-usage mono">{skill.usage} uses</span>}
    </div>
  );
}

function SkillsBrowser({ skills, onToggle, busyName }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.description || "").toLowerCase().includes(q) || (s.category || "").toLowerCase().includes(q)
    );
  }, [skills, query]);

  return (
    <div className="skills-browser">
      <input
        type="text"
        className="skills-search mono"
        placeholder={`Filter ${skills.length} skills…`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="skills-grid">
        {filtered.map((s) => (
          <SkillCard key={s.name} skill={s} onToggle={onToggle} busy={busyName === s.name} />
        ))}
        {filtered.length === 0 && <p className="panel-empty">No skills match "{query}".</p>}
      </div>
    </div>
  );
}

/*
  Plugins — derived category, not backend data. The CLI's `list --json`
  gives name/status/version/description/source only; grouping by name
  suffix/prefix and description keywords turns an 85-entry flat list into
  something scannable without inventing anything the backend didn't say.
*/
function categorizePlugin(p) {
  const name = p.name || "";
  const desc = (p.description || "").toLowerCase();
  if (name.endsWith("-platform")) return "Messaging platform";
  if (name.endsWith("-provider")) return "Model provider";
  if (name.startsWith("browser-")) return "Browser backend";
  if (name.startsWith("web-")) return "Web search";
  if (desc.includes("dashboard auth provider")) return "Dashboard auth";
  if (desc.includes("video generation")) return "Video generation";
  if (desc.includes("image generation")) return "Image generation";
  if (desc.includes("observability")) return "Observability";
  return "Other";
}

function PluginCard({ plugin, ambiguous, onToggle, busy }) {
  const enabled = plugin.status === "enabled";
  return (
    <div className="glass-card skill-card">
      <div className="skill-card-head">
        <span className={`led-dot${enabled ? " led-dot--on led-dot--pulse" : ""}`} title={enabled ? "enabled" : "disabled"} />
        <span className="skill-name mono">{plugin.name}</span>
        <label
          className="toggle-switch skill-toggle"
          title={
            ambiguous
              ? `Multiple installed plugins share the name "${plugin.name}" — the CLI can't tell them apart either, so toggle from the CLI directly: hermes plugins ${enabled ? "disable" : "enable"} ${plugin.name}`
              : enabled
                ? "Disable plugin"
                : "Enable plugin"
          }
        >
          <input type="checkbox" checked={enabled} disabled={busy || ambiguous} onChange={() => onToggle(plugin)} />
          <span className="toggle-switch-track" />
        </label>
      </div>
      <span className="tag-badge">{categorizePlugin(plugin)}</span>
      <p className="skill-desc">{plugin.description}</p>
      <span className="skill-usage mono">
        v{plugin.version} · {plugin.source}
        {ambiguous && " · ambiguous name"}
      </span>
    </div>
  );
}

function PluginsBrowser({ plugins, onToggle, busyName }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const nameCounts = useMemo(() => {
    const counts = new Map();
    for (const p of plugins) counts.set(p.name, (counts.get(p.name) || 0) + 1);
    return counts;
  }, [plugins]);

  const categories = useMemo(() => ["all", ...new Set(plugins.map(categorizePlugin))].sort((a, b) => (a === "all" ? -1 : a.localeCompare(b))), [plugins]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return plugins.filter((p) => {
      if (category !== "all" && categorizePlugin(p) !== category) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q);
    });
  }, [plugins, query, category]);

  const enabledCount = plugins.filter((p) => p.status === "enabled").length;

  return (
    <div className="skills-browser">
      <div className="plugins-toolbar">
        <input
          type="text"
          className="skills-search mono"
          placeholder={`Filter ${plugins.length} plugins (${enabledCount} enabled)…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="skills-search mono plugins-category-select" value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "all categories" : c}
            </option>
          ))}
        </select>
      </div>
      <div className="skills-grid">
        {filtered.map((p, i) => (
          <PluginCard
            key={`${p.name}-${i}`}
            plugin={p}
            ambiguous={nameCounts.get(p.name) > 1}
            onToggle={onToggle}
            busy={busyName === p.name}
          />
        ))}
        {filtered.length === 0 && <p className="panel-empty">No plugins match "{query}".</p>}
      </div>
    </div>
  );
}

/*
  HermesPage — the agent's own control room: SOUL.md editor, gateway
  restart, active profile, every skill Hermes has picked up, the memory
  system (providers + learning graph), and every installed plugin with a
  real enable/disable toggle. Automations (cron) intentionally isn't
  duplicated here — full management already lives on the Jobs tab.
*/
export function HermesPage() {
  const [profiles, setProfiles] = useState(null);
  const [skills, setSkills] = useState(null);
  const [memory, setMemory] = useState(null);
  const [graph, setGraph] = useState(null);
  const [error, setError] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [restart, setRestart] = useState("idle"); // idle | busy | done | error
  const [selectedMemory, setSelectedMemory] = useState(null);
  const [busySkill, setBusySkill] = useState(null);

  const [pluginsStatus, setPluginsStatus] = useState(null);
  const [plugins, setPlugins] = useState(null);
  const [pluginsError, setPluginsError] = useState(null);
  const [busyPlugin, setBusyPlugin] = useState(null);

  const loadGraph = useCallback(async () => {
    try {
      const g = await fetchHermesLearningGraph();
      setGraph(g);
    } catch {
      /* keep the last good graph rather than blanking it on a transient failure */
    }
  }, []);

  const loadPlugins = useCallback(async () => {
    try {
      const st = await fetchPluginsStatus();
      setPluginsStatus(st);
      if (!st.configured) {
        setPlugins([]);
        return;
      }
      const res = await fetchPluginsList();
      setPlugins(Array.isArray(res.data) ? res.data : []);
      setPluginsError(null);
    } catch (err) {
      setPluginsError(err.message || String(err));
    }
  }, []);

  useEffect(() => {
    loadPlugins();
  }, [loadPlugins]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [profRes, skillsRes, memRes, graphRes] = await Promise.allSettled([
        fetchHermesProfiles(),
        fetchSkillsFull(),
        fetchHermesMemory(),
        fetchHermesLearningGraph(),
      ]);
      if (!mounted) return;
      if (profRes.status === "fulfilled") setProfiles(profRes.value?.profiles || []);
      if (skillsRes.status === "fulfilled") setSkills(Array.isArray(skillsRes.value) ? skillsRes.value : []);
      if (memRes.status === "fulfilled") setMemory(memRes.value);
      if (graphRes.status === "fulfilled") setGraph(graphRes.value);
      if ([profRes, skillsRes, memRes, graphRes].every((r) => r.status === "rejected")) {
        setLoadError(profRes.reason?.message || "Could not reach the dashboard.");
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const activeProfile = profiles?.find((p) => p.is_default) || profiles?.[0];

  const onToggleSkill = useCallback(async (skill) => {
    setBusySkill(skill.name);
    const nextEnabled = !skill.enabled;
    setSkills((prev) => prev.map((s) => (s.name === skill.name ? { ...s, enabled: nextEnabled } : s)));
    try {
      await toggleSkill(skill.name, nextEnabled);
    } catch (err) {
      setSkills((prev) => prev.map((s) => (s.name === skill.name ? { ...s, enabled: skill.enabled } : s)));
      setError(err.message || String(err));
    } finally {
      setBusySkill(null);
    }
  }, []);

  const onTogglePlugin = useCallback(async (plugin) => {
    setBusyPlugin(plugin.name);
    const wasEnabled = plugin.status === "enabled";
    const nextStatus = wasEnabled ? "not enabled" : "enabled";
    setPlugins((prev) => prev.map((p) => (p === plugin ? { ...p, status: nextStatus } : p)));
    try {
      const result = wasEnabled ? await disablePlugin(plugin.name) : await enablePlugin(plugin.name);
      if (result?.message) setPluginsError(null);
    } catch (err) {
      setPlugins((prev) => prev.map((p) => (p === plugin ? { ...p, status: plugin.status } : p)));
      setPluginsError(err.message || String(err));
    } finally {
      setBusyPlugin(null);
    }
  }, []);

  const onRestart = useCallback(async () => {
    if (!window.confirm("Restart the Hermes gateway now? Any in-flight run will be interrupted.")) return;
    setRestart("busy");
    try {
      await restartGateway();
      setRestart("done");
      setTimeout(() => setRestart("idle"), 2500);
    } catch (err) {
      setError(err.message || String(err));
      setRestart("error");
    }
  }, []);

  return (
    <PageShell
      title="Hermes"
      headerExtra={
        <button type="button" className="btn-pill btn-pill--danger" disabled={restart === "busy"} onClick={onRestart}>
          {restart === "busy" ? "restarting…" : restart === "done" ? "restarted" : "restart gateway"}
        </button>
      }
    >
      {loadError && (
        <DiagnosticCard
          title="Hermes data unavailable"
          detail={loadError}
          hint="Check HERMES_DASHBOARD_BASE_URL/USERNAME/PASSWORD in .env.local, or that the dashboard container is reachable."
        />
      )}
      {error && <p className="panel-error">{error}</p>}

      <div className="panel-section">
        <p className="panel-section-title">Profile</p>
        {!profiles && !loadError && <p className="panel-empty">Loading…</p>}
        {activeProfile && (
          <div className="panel-card profile-card">
            <div className="profile-head">
              <span className="profile-name">{activeProfile.name}</span>
              {activeProfile.is_default && <span className="profile-badge mono">default</span>}
            </div>
            <div className="profile-meta mono">
              <span>{activeProfile.provider} / {activeProfile.model}</span>
              <span>{activeProfile.skill_count} skills</span>
              <span>{activeProfile.gateway_running ? "gateway running" : "gateway stopped"}</span>
            </div>
          </div>
        )}
      </div>

      <div className="panel-section">
        <p className="panel-section-title">SOUL.md</p>
        <SoulEditor profileName={activeProfile?.name || "default"} />
      </div>

      <div className="panel-section">
        <p className="panel-section-title">Skills</p>
        {!skills && !loadError && <p className="panel-empty">Loading…</p>}
        {skills && <SkillsBrowser skills={skills} onToggle={onToggleSkill} busyName={busySkill} />}
      </div>

      <div className="panel-section">
        <p className="panel-section-title">Memory</p>
        {!memory && !loadError && <p className="panel-empty">Loading…</p>}
        {memory && graph && <MemoryStudio memory={memory} graph={graph} />}
        {memory && (
          <div className="memory-providers">
            {memory.providers.map((p) => (
              <div key={p.name} className="panel-card memory-provider">
                <div className="memory-provider-head">
                  <span className={`job-dot job-dot--${memoryTone(p.status)}`} />
                  <span className="memory-provider-name">{p.name}</span>
                  {memory.active === p.name && <span className="profile-badge mono">active</span>}
                  <span className="memory-provider-status mono">{p.status}</span>
                </div>
                <p className="toolset-desc">{p.description}</p>
              </div>
            ))}
          </div>
        )}
        {graph && (
          <>
            <MemoryEntryCards graph={graph} onSelect={setSelectedMemory} />
            <div className="panel-card">
              <MemoryGraph graph={graph} skills={skills} onSelect={setSelectedMemory} />
            </div>
          </>
        )}
      </div>

      <MemoryDetailDrawer entry={selectedMemory} onClose={() => setSelectedMemory(null)} onChanged={loadGraph} />

      <div className="panel-section">
        <p className="panel-section-title">Plugins</p>
        {pluginsStatus && !pluginsStatus.configured && (
          <DiagnosticCard
            title="Plugins bridge not configured"
            detail="No HTTP endpoint exists for plugins on this build — the bridge SSHes into the Hermes box and runs the real CLI instead."
            hint="Set HERMES_SSH_HOST / HERMES_SSH_KEY_PATH in .env.local (see .env.local.example)."
          />
        )}
        {pluginsError && (
          <DiagnosticCard title="Plugins unavailable" detail={pluginsError} hint="Check the SSH bridge can reach the box and the container is running." />
        )}
        {!plugins && !pluginsError && <p className="panel-empty">Loading…</p>}
        {plugins && plugins.length === 0 && !pluginsError && pluginsStatus?.configured && (
          <p className="panel-empty">No plugins reported by the CLI.</p>
        )}
        {plugins && plugins.length > 0 && <PluginsBrowser plugins={plugins} onToggle={onTogglePlugin} busyName={busyPlugin} />}
      </div>
    </PageShell>
  );
}
