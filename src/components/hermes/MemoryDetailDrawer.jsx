import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { fetchLearningNode, updateLearningNode, deleteLearningNode } from "../../lib/hermesBridge.js";
import "./MemoryDetailDrawer.css";

function formatDate(ts) {
  if (!ts) return null;
  return new Date(ts * 1000).toLocaleString();
}

/*
  MemoryDetailDrawer — the shared side panel for "inspect this memory or
  skill", opened from either a MemoryGraph node click or a memory card
  click. Editing/deleting is scoped to memory entries only: the real
  backend (agent/learning_mutations.py) supports both kinds, but a skill
  entry's shown `body` here is just its short description, not its full
  SKILL.md — editing that in place would overwrite the real file with
  the description. Skills stay read-only here; toggle them from the
  Hermes page's Skills grid instead.
*/
export function MemoryDetailDrawer({ entry, onClose, onChanged }) {
  const [mode, setMode] = useState("view"); // view | editing | saving | deleting
  const [content, setContent] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    setMode("view");
    setContent("");
    setError(null);
  }, [entry]);

  useEffect(() => {
    if (!entry) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (mode === "editing") setMode("view");
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entry, onClose, mode]);

  const startEdit = async () => {
    setError(null);
    try {
      const fresh = await fetchLearningNode(entry.id);
      setContent(fresh.content ?? entry.body ?? "");
      setMode("editing");
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  const save = async () => {
    setMode("saving");
    setError(null);
    try {
      await updateLearningNode(entry.id, content);
      setMode("view");
      onChanged?.();
      onClose();
    } catch (err) {
      setError(err.message || String(err));
      setMode("editing");
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this memory? This removes it from Hermes's memory file.")) return;
    setMode("deleting");
    setError(null);
    try {
      await deleteLearningNode(entry.id);
      onChanged?.();
      onClose();
    } catch (err) {
      setError(err.message || String(err));
      setMode("view");
    }
  };

  const editable = entry?.kind === "memory" && entry.id;

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

            {mode === "editing" || mode === "saving" ? (
              <>
                <textarea
                  className="memory-drawer-textarea mono"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  disabled={mode === "saving"}
                  autoFocus
                />
                {error && <p className="panel-error">{error}</p>}
                <div className="memory-drawer-actions">
                  <button type="button" className="btn-pill" onClick={() => setMode("view")} disabled={mode === "saving"}>
                    cancel
                  </button>
                  <button type="button" className="btn-pill" onClick={save} disabled={mode === "saving" || !content.trim()}>
                    {mode === "saving" ? "saving…" : "save"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="memory-drawer-title">{entry.title}</h2>
                <p className="memory-drawer-body">{entry.body}</p>
                {error && <p className="panel-error">{error}</p>}
                <div className="memory-drawer-meta mono">
                  {entry.timestamp != null && <span>{formatDate(entry.timestamp)}</span>}
                  {entry.useCount != null && <span>{entry.useCount} uses</span>}
                </div>
                {editable && (
                  <div className="memory-drawer-actions">
                    <button type="button" className="btn-pill btn-pill--danger" onClick={remove} disabled={mode === "deleting"}>
                      {mode === "deleting" ? "deleting…" : "delete"}
                    </button>
                    <button type="button" className="btn-pill" onClick={startEdit}>
                      edit
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
