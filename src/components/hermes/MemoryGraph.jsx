import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/*
  MemoryGraph — an interactive radial map of the learning graph (skills
  the agent has picked up + the memories that spawned them). No graph
  library: with the graph's real size (a few dozen nodes) a fixed
  circular layout plus Framer Motion for hover/selection reads fine and
  costs nothing extra to ship.

  Hover a node → a small popover with its label + category. Click a
  node → `onSelect(entry)` with the full record, so the parent can open
  the shared MemoryDetailDrawer (same drawer the memory card grid uses).
*/
export function MemoryGraph({ graph, skills, onSelect }) {
  const [hoverId, setHoverId] = useState(null);

  const { nodes, edges, pos } = useMemo(() => {
    const ns = graph?.nodes || [];
    const W = 640;
    const H = 420;
    const cx = W / 2;
    const cy = H / 2;
    const r = Math.min(W, H) / 2 - 56;
    const p = {};
    ns.forEach((n, i) => {
      const angle = (i / ns.length) * Math.PI * 2 - Math.PI / 2;
      p[n.id] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    });
    return { nodes: ns, edges: graph?.edges || [], pos: p };
  }, [graph]);

  if (!graph || !nodes.length) {
    return <p className="panel-empty">No graph data yet.</p>;
  }

  const skillByName = new Map((skills || []).map((s) => [s.name, s]));

  function nodeToEntry(node) {
    if (node.kind === "memory") {
      const idx = Number(node.id.split(":").pop());
      const mem = graph.memory?.[idx];
      return {
        kind: "memory",
        title: mem?.title || node.label,
        body: mem?.body || node.label,
        category: node.category,
        timestamp: node.timestamp,
        useCount: node.useCount,
      };
    }
    const skill = skillByName.get(node.label);
    return {
      kind: "skill",
      title: node.label,
      body: skill?.description || "No description available.",
      category: node.category || skill?.category,
      timestamp: node.timestamp,
      useCount: node.useCount,
    };
  }

  const hovered = hoverId ? nodes.find((n) => n.id === hoverId) : null;
  const hoveredPos = hovered ? pos[hovered.id] : null;

  return (
    <div className="memory-graph-wrap">
      <svg viewBox="0 0 640 420" className="memory-graph-svg" role="img" aria-label="Learning graph">
        {edges.map((e, i) => {
          const a = pos[e.source];
          const b = pos[e.target];
          if (!a || !b) return null;
          const dim = hoverId && e.source !== hoverId && e.target !== hoverId;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className="memory-graph-edge"
              opacity={dim ? 0.25 : 1}
            />
          );
        })}
        {nodes.map((n) => {
          const p = pos[n.id];
          if (!p) return null;
          const isHover = hoverId === n.id;
          return (
            <motion.g
              key={n.id}
              className={`memory-graph-node memory-graph-node--${n.kind}`}
              onMouseEnter={() => setHoverId(n.id)}
              onMouseLeave={() => setHoverId((h) => (h === n.id ? null : h))}
              onClick={() => onSelect?.(nodeToEntry(n))}
              style={{ cursor: "pointer" }}
              animate={{ scale: isHover ? 1.6 : 1 }}
              transition={{ duration: 0.15 }}
            >
              <circle cx={p.x} cy={p.y} r={n.kind === "skill" ? 6 : 4} />
            </motion.g>
          );
        })}
      </svg>

      <AnimatePresence>
        {hovered && hoveredPos && (
          <motion.div
            className="memory-graph-tooltip"
            style={{ left: `${(hoveredPos.x / 640) * 100}%`, top: `${(hoveredPos.y / 420) * 100}%` }}
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.14 }}
          >
            <p className="memory-graph-tooltip-title">{hovered.label}</p>
            {hovered.category && <span className="tag-badge">{hovered.category}</span>}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="memory-graph-legend mono">
        <span>
          <span className="legend-dot legend-dot--skill" /> skill
        </span>
        <span>
          <span className="legend-dot legend-dot--memory" /> memory
        </span>
        <span className="memory-graph-count">
          {nodes.length} nodes · {edges.length} links · click to inspect
        </span>
      </div>
    </div>
  );
}
