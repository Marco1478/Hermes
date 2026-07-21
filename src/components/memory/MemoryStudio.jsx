/*
  MemoryStudio — a summary strip above the existing memory graph/cards
  (HermesPage.jsx already renders real providers + entries + edit/delete;
  this adds what was missing: real counts instead of a guessed "capacity",
  and honestly-disabled actions for capabilities that have no backend yet
  rather than faking them).
*/
export function MemoryStudio({ memory, graph }) {
  const memoryNodes = (graph?.nodes || []).filter((n) => n.kind === "memory");
  const skillNodes = (graph?.nodes || []).filter((n) => n.kind === "skill");
  const readyProviders = (memory?.providers || []).filter((p) => p.status === "ready").length;

  return (
    <div className="panel-card memory-studio">
      <div className="memory-studio-stats">
        <div className="memory-studio-stat">
          <span className="overview-tile-label mono">MEMORY ENTRIES</span>
          <span className="overview-tile-value">{memoryNodes.length}</span>
        </div>
        <div className="memory-studio-stat">
          <span className="overview-tile-label mono">LEARNED SKILLS</span>
          <span className="overview-tile-value">{skillNodes.length}</span>
        </div>
        <div className="memory-studio-stat">
          <span className="overview-tile-label mono">PROVIDERS READY</span>
          <span className="overview-tile-value">
            {readyProviders}/{memory?.providers?.length ?? 0}
          </span>
        </div>
      </div>

      <div className="memory-studio-actions">
        <button type="button" className="btn-pill" disabled title="No create-node endpoint exists on this build (verified against agent/learning_mutations.py — only edit + delete). Edit an existing entry, or add memory via Hermes itself in chat.">
          + new memory entry
        </button>
        <button type="button" className="btn-pill" disabled title="No endpoint promotes a memory entry into a real skill file on this build — this would need a real 'materialize skill from memory' action server-side, which doesn't exist yet.">
          convert to skill
        </button>
      </div>
    </div>
  );
}
