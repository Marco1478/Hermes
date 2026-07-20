/*
  usage — token-usage bookkeeping for the hero rings.

  OpenAI (Hermes): there's no usage endpoint on the gateway, but each run
  reports a real `usage.total_tokens`. We accumulate those locally
  (localStorage) into a rolling 7-day bucket that auto-resets a week after
  it started. This is genuine consumption through THIS UI — it won't
  include tokens Hermes spends when driven from Telegram/Discord, which
  the gateway simply doesn't expose to us.

  Anthropic (Claude Code): read from local transcript logs by the dev
  middleware at /local/claude-usage (see vite-plugins/claudeUsage.js).
*/

const OPENAI_KEY = "hermes-ui.openai-usage.v1";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function readRaw() {
  try {
    const raw = localStorage.getItem(OPENAI_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data?.weekStart !== "number" || typeof data?.tokens !== "number") return null;
    return data;
  } catch {
    return null;
  }
}

function writeRaw(data) {
  try {
    localStorage.setItem(OPENAI_KEY, JSON.stringify(data));
  } catch {
    /* storage full / disabled — usage tracking is best-effort */
  }
}

/* Returns the current bucket, rolling it over if the week has elapsed. */
export function getOpenAiUsage() {
  const now = Date.now();
  let data = readRaw();
  if (!data || now - data.weekStart >= WEEK_MS) {
    data = { weekStart: now, tokens: 0 };
    writeRaw(data);
  }
  return data;
}

/* Adds tokens from a completed run and returns the updated bucket. */
export function addOpenAiTokens(tokens) {
  if (!tokens || tokens <= 0) return getOpenAiUsage();
  const current = getOpenAiUsage();
  const next = { weekStart: current.weekStart, tokens: current.tokens + tokens };
  writeRaw(next);
  return next;
}

export async function fetchAnthropicUsage(signal) {
  const res = await fetch("/local/claude-usage", { signal });
  if (!res.ok) throw new Error(`claude-usage HTTP ${res.status}`);
  return res.json();
}

export { WEEK_MS };
