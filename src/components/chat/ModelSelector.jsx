import { useEffect, useRef, useState } from "react";
import { useChat } from "../../state/Chat.jsx";
import { HERMES_MODELS } from "../../data/hermesModels.js";
import { setDashboardModel } from "../../lib/dashboard.js";
import "./ModelSelector.css";

/*
  ModelSelector — the chat header's model picker. Picking a model calls
  the dashboard proxy (see lib/dashboard.js) to ACTUALLY change what
  Hermes runs on — the gateway API has no such capability (confirmed: it
  echoes but ignores a `model` field on /v1/runs). This is a GLOBAL
  change (Telegram, Discord, every platform Hermes serves), not scoped to
  this chat, even though the picker lives in one chat's header — there is
  no per-run model routing anywhere in this stack. The per-chat `model`
  field is kept as a local label for "which model I picked last here";
  only the CURRENTLY active one is ever really in effect.
*/
export function ModelSelector() {
  const { activeModel, setModel } = useChat();
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(null); /* model id being applied, or null */
  const [error, setError] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = HERMES_MODELS.find((m) => m.id === activeModel) || HERMES_MODELS[0];

  const pick = async (m) => {
    if (m.id === activeModel || applying) return;
    setError(null);
    setApplying(m.id);
    try {
      await setDashboardModel(m.id);
      setModel(m.id);
      setOpen(false);
    } catch (err) {
      setError(err.message || "Failed to switch model");
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="model-selector" ref={rootRef}>
      <button
        type="button"
        className="model-trigger mono"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Hermes's live model (global — applies to every platform)"
      >
        <span className={`model-dot${applying ? " model-dot--busy" : ""}`} aria-hidden="true" />
        {current.label}
        <span className="model-caret" aria-hidden="true">
          ⌄
        </span>
      </button>
      {open && (
        <div className="model-menu">
          <p className="model-menu-note mono">Global — Telegram &amp; Discord too</p>
          <ul className="model-menu-list" role="listbox">
            {HERMES_MODELS.map((m) => (
              <li key={m.id} role="option" aria-selected={m.id === activeModel}>
                <button
                  type="button"
                  className={`model-option mono${m.id === activeModel ? " model-option--active" : ""}`}
                  disabled={applying != null}
                  onClick={() => pick(m)}
                >
                  <span>{m.label}</span>
                  {m.note && <span className="model-note">{m.note}</span>}
                  {applying === m.id && <span className="model-spin" aria-hidden="true" />}
                  {m.id === activeModel && applying !== m.id && (
                    <span className="model-check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {error && <p className="model-menu-error mono">{error}</p>}
        </div>
      )}
    </div>
  );
}
