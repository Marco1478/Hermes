function truncate(text, n) {
  if (!text || text.length <= n) return text;
  return `${text.slice(0, n).trimEnd()}…`;
}

/*
  MemoryEntryCards — the actual memory content (graph.memory[]) as a
  clickable card grid instead of flat text, each tagged with its real
  category from the matching learning-graph node. Clicking a card opens
  the same MemoryDetailDrawer a graph-node click would.
*/
export function MemoryEntryCards({ graph, onSelect }) {
  const memories = graph?.memory || [];
  if (memories.length === 0) return <p className="panel-empty">No memory entries yet.</p>;

  const categoryById = new Map((graph.nodes || []).filter((n) => n.kind === "memory").map((n, i) => [i, n.category]));

  return (
    <div className="memory-cards-grid">
      {memories.map((m, i) => (
        <button
          key={i}
          type="button"
          className="panel-card glass-card--interactive memory-entry-card"
          onClick={() =>
            onSelect?.({
              id: `memory:${m.source}:${i}`,
              kind: "memory",
              title: m.title,
              body: m.body,
              category: categoryById.get(i) || m.source,
              timestamp: m.timestamp,
              useCount: null,
            })
          }
        >
          <span className="tag-badge memory-entry-tag">{categoryById.get(i) || m.source}</span>
          <p className="memory-entry-body">{truncate(m.body, 160)}</p>
        </button>
      ))}
    </div>
  );
}
