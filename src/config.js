/*
  Central config. The gateway address is the one real backend this UI
  talks to today (chat routing + health). Override at build time with
  Vite env vars (VITE_GATEWAY_BASE_URL) once this moves off localhost
  dev — hardcoded LAN default for now, same address used everywhere
  else in this project.
*/
export const GATEWAY_BASE_URL =
  import.meta.env.VITE_GATEWAY_BASE_URL || "http://192.168.2.11:8642";

/*
  Where the app actually fetches from. The gateway's API server doesn't
  send CORS headers, so direct browser fetches to GATEWAY_BASE_URL get
  blocked before a response comes back (confirmed with curl vs. fetch).
  In dev, Vite proxies "/gw" → GATEWAY_BASE_URL server-side (see
  vite.config.js), which sidesteps the browser's CORS check entirely.
  GATEWAY_BASE_URL itself stays around for the human-readable display.
*/
export const GATEWAY_FETCH_BASE = "/gw";

/*
  The API_SERVER_KEY set on the gateway (hermes config set / .env on the
  Hermes box). Never hardcode the real value here — put it in a git-
  ignored .env.local (see .env.local.example) as VITE_GATEWAY_API_KEY.
  Empty by default so a missing key fails loudly instead of silently.
*/
export const GATEWAY_API_KEY = import.meta.env.VITE_GATEWAY_API_KEY || "";

/*
  Usage-ring budgets. The ring shows real token usage as a percentage of
  a weekly (or 5-hour) cap. Neither OpenAI's ChatGPT/Codex subscription
  nor Anthropic's Claude subscription publishes an exact token quota via
  API, so these caps are our own reference ceilings — tune them to match
  what actually feels like "a full week" for you. The token COUNTS are
  real; only the % denominator is this configurable target.

  - OpenAI: summed from each Hermes run's reported usage.total_tokens
    (accumulated locally, reset weekly).
  - Anthropic: summed from local Claude Code transcripts (5h + 7d
    windows) served by the dev-only /local/claude-usage endpoint.
*/
export const OPENAI_WEEKLY_TOKEN_BUDGET = Number(
  import.meta.env.VITE_OPENAI_WEEKLY_TOKEN_BUDGET || 5_000_000
);
export const ANTHROPIC_5H_TOKEN_BUDGET = Number(
  import.meta.env.VITE_ANTHROPIC_5H_TOKEN_BUDGET || 10_000_000
);
export const ANTHROPIC_WEEKLY_TOKEN_BUDGET = Number(
  import.meta.env.VITE_ANTHROPIC_WEEKLY_TOKEN_BUDGET || 150_000_000
);
