/*
  The OpenAI models Marco has configured on his Hermes box. `gpt-5.5` is
  the current gateway default. These are passed as the `model` field in the
  run payload (see lib/gatewayRuns.js). NOTE: at the time of writing the
  gateway echoes this field but routes to its configured default regardless
  — kept here so the UI is ready the moment per-run model routing is
  enabled server-side.
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
