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
  fetchCronJobs,
} from "../../lib/hermesBridge.js";
import { useViewMode } from "../../state/ViewMode.jsx";
import { PageShell } from "../PageShell.jsx";
import { MemoryGraph } from "./MemoryGraph.jsx";
import { MemoryEntryCards } from "./MemoryEntryCards.jsx";
import { MemoryDetailDrawer } from "./MemoryDetailDrawer.jsx";
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
        placeholder="SOUL.md is empty."
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
  HermesPage — the agent's own control room: SOUL.md editor, gateway
  restart, active profile, every skill Hermes has picked up, the memory
  system (providers + learning graph), and a read-only summary of the
  automations it runs on its own (full management lives on the Jobs
  tab — this is "what's set up", not "manage it").
*/
export function HermesPage() {
  const { goTo } = useViewMode();
  const [profiles, setProfiles] = useState(null);
  const [skills, setSkills] = useState(null);
  const [memory, setMemory] = useState(null);
  const [graph, setGraph] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState(null);
  const [restart, setRestart] = useState("idle"); // idle | busy | done | error
  const [selectedMemory, setSelectedMemory] = useState(null);
  const [busySkill, setBusySkill] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [profRes, skillsRes, memRes, graphRes, jobsRes] = await Promise.allSettled([
        fetchHermesProfiles(),
        fetchSkillsFull(),
        fetchHermesMemory(),
        fetchHermesLearningGraph(),
        fetchCronJobs(),
      ]);
      if (!mounted) return;
      if (profRes.status === "fulfilled") setProfiles(profRes.value?.profiles || []);
      if (skillsRes.status === "fulfilled") setSkills(Array.isArray(skillsRes.value) ? skillsRes.value : []);
      if (memRes.status === "fulfilled") setMemory(memRes.value);
      if (graphRes.status === "fulfilled") setGraph(graphRes.value);
      if (jobsRes.status === "fulfilled") setJobs(jobsRes.value || []);
      if ([profRes, skillsRes, memRes, graphRes, jobsRes].every((r) => r.status === "rejected")) {
        setError("Could not reach the dashboard.");
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
      {error && <p className="panel-error">{error}</p>}

      <div className="panel-section">
        <p className="panel-section-title">Profile</p>
        {!profiles && !error && <p className="panel-empty">Loading…</p>}
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
        {!skills && !error && <p className="panel-empty">Loading…</p>}
        {skills && <SkillsBrowser skills={skills} onToggle={onToggleSkill} busyName={busySkill} />}
      </div>

      <div className="panel-section">
        <p className="panel-section-title">Memory</p>
        {!memory && !error && <p className="panel-empty">Loading…</p>}
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

      <MemoryDetailDrawer entry={selectedMemory} onClose={() => setSelectedMemory(null)} />

      <div className="panel-section">
        <div className="automations-head">
          <p className="panel-section-title" style={{ marginBottom: 0 }}>
            Automations
          </p>
          <button type="button" className="btn-pill" onClick={() => goTo("jobs")}>
            manage in jobs →
          </button>
        </div>
        {!jobs && !error && <p className="panel-empty">Loading…</p>}
        {jobs && jobs.length === 0 && <p className="panel-empty">No automations created yet.</p>}
        <div className="automations-list">
          {jobs?.map((j) => (
            <div key={j.id} className="automations-row mono">
              <span className={`job-dot job-dot--${j.enabled ? "ok" : "dim"}`} />
              <span className="automations-name">{j.name || j.id}</span>
              <span className="automations-schedule">{j.schedule_display || j.schedule?.expr}</span>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
