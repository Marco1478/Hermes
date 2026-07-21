/*
  Real openai-codex catalog ids (confirmed against provider_models_cache.json
  on the box, and by actually switching live and having Hermes self-report
  the new model — see ModelSelector.jsx). This is the static fallback shown
  before/if the bridge's live dashboard fetch (GET /local/hermes/models)
  succeeds; the gateway's own /v1/runs ignores a bare `model` field
  (confirmed live) — the real switch path is the dashboard's
  POST /api/model/set with an explicit provider, wired through
  vite-plugins/hermesBridge.js.
*/
export const HERMES_MODELS = [
  { id: "gpt-5.5", label: "5.5", note: "default" },
  { id: "gpt-5.6-sol", label: "5.6 Sol" },
  { id: "gpt-5.6-terra", label: "5.6 Terra" },
  { id: "gpt-5.6-luna", label: "5.6 Luna" },
  { id: "gpt-5.6-sol-pro", label: "5.6 Sol Pro" },
  { id: "gpt-5.6-terra-pro", label: "5.6 Terra Pro" },
  { id: "gpt-5.6-luna-pro", label: "5.6 Luna Pro" },
];

export const DEFAULT_MODEL = "gpt-5.5";
