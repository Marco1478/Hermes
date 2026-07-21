import { useEffect, useRef, useState } from "react";
import { useChat } from "../../state/Chat.jsx";
import { HERMES_MODELS, DEFAULT_MODEL } from "../../data/hermesModels.js";
import { fetchHermesModels, setHermesModel } from "../../lib/hermesBridge.js";
import "./ModelSelector.css";

/* Marco's actual account/provider (verified live — the dashboard's model
   catalog is namespaced by provider, e.g. "nous" portal vs "openai-codex"
   direct; passing model without provider let /api/model/set silently land
   on the wrong one). HERMES_MODELS are that provider's real model ids,
   confirmed against provider_models_cache.json on the box. */
const PROVIDER = "openai-codex";

/*
  ModelSelector — the chat header's model picker. Goes through the Hermes
  bridge (see lib/hermesBridge.js / vite-plugins/hermesBridge.js), which
  calls the dashboard's real POST /api/model/set — the gateway API has no
  such capability (confirmed: it echoes but ignores a `model` field on
  /v1/runs). This is a GLOBAL change (Telegram, Discord, every platform
  Hermes serves), not scoped to this chat — there is no per-run model
  routing anywhere in this stack. The per-chat `model` field is kept as a
  local label for "which model I picked last here"; only the CURRENTLY
  active one is ever really in effect.

  The option list starts from the known static catalog and swaps to the
  bridge's live dashboard data when available — the small badge says
  which one is showing, never pretends the static list is authoritative.
*/
export function ModelSelector() {
  const { activeModel, setModel } = useChat();
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(null); /* model id being applied, or null */
  const [error, setError] = useState(null);
  const [models, setModels] = useState(HERMES_MODELS);
  const [source, setSource] = useState("static-fallback");
  const rootRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetchHermesModels()
      .then((data) => {
        if (cancelled) return;
        const live = (data.options || [])
          .filter((o) => o.provider === PROVIDER)
          .map((o) => ({ id: o.model, label: o.model.replace(/^gpt-/, "") }));
        if (live.length) setModels(live);
        setSource(data.source || "static-fallback");
      })
      .catch(() => {
        /* stay on the static list — badge already defaults to static-fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const current = models.find((m) => m.id === activeModel) || models.find((m) => m.id === DEFAULT_MODEL) || models[0];

  const pick = async (m) => {
    if (m.id === activeModel || applying) return;
    setError(null);
    setApplying(m.id);
    try {
      await setHermesModel({ provider: PROVIDER, model: m.id });
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
        {current?.label ?? activeModel}
        <span className="model-caret" aria-hidden="true">
          ⌄
        </span>
      </button>
      {open && (
        <div className="model-menu">
          <p className="model-menu-note mono">
            Global — Telegram &amp; Discord too
            <span className={`model-source-badge${source === "dashboard" ? " model-source-badge--live" : ""}`}>
              {source === "dashboard" ? "live" : "static"}
            </span>
          </p>
          <ul className="model-menu-list" role="listbox">
            {models.map((m) => (
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
