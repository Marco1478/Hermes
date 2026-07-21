/*
  usage — the Anthropic/Claude Code side of the hero orbs.

  Anthropic (Claude Code): read from Marco's local transcript logs by the
  dev middleware at /local/claude-usage (see vite-plugins/claudeUsage.js) —
  his own dev-machine Claude usage, deliberately separate from Hermes.

  OpenAI/Hermes usage no longer lives here: it now comes from the real
  dashboard token analytics via lib/hermesBridge.js's fetchAnalyticsUsage
  (which counts ALL Hermes usage, Telegram/Discord/UI, not just this tab).
  The old localStorage accumulator this file used to hold was removed.
*/

export async function fetchAnthropicUsage(signal) {
  const res = await fetch("/local/claude-usage", { signal });
  if (!res.ok) throw new Error(`claude-usage HTTP ${res.status}`);
  return res.json();
}
