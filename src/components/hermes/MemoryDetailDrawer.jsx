import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import "./MemoryDetailDrawer.css";

function formatDate(ts) {
  if (!ts) return null;
  return new Date(ts * 1000).toLocaleString();
}

/*
  MemoryDetailDrawer — the shared side panel for "inspect this memory or
  skill", opened from either a MemoryGraph node click or a memory card
  click. One drawer, one shape (`entry`), two entry points.
*/
export function MemoryDetailDrawer({ entry, onClose }) {
  useEffect(() => {
    if (!entry) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entry, onClose]);

  return (
    <AnimatePresence>
      {entry && (
        <>
          <motion.div
            className="memory-drawer-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.aside
            className="memory-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            role="dialog"
            aria-label="Memory detail"
          >
            <div className="memory-drawer-head">
              <span className="tag-badge memory-drawer-kind">{entry.kind}</span>
              {entry.category && <span className="tag-badge">{entry.category}</span>}
              <button type="button" className="memory-drawer-close" onClick={onClose} aria-label="Close">
                ×
              </button>
            </div>
            <h2 className="memory-drawer-title">{entry.title}</h2>
            <p className="memory-drawer-body">{entry.body}</p>
            <div className="memory-drawer-meta mono">
              {entry.timestamp != null && <span>{formatDate(entry.timestamp)}</span>}
              {entry.useCount != null && <span>{entry.useCount} uses</span>}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
