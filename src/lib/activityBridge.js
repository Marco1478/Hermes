/*
  activityBridge (client) — local git log + docs/claude status doc listing,
  served by vite-plugins/activityBridge.js straight off the disk this Vite
  server runs from (no SSH, unlike Kanban).
*/
async function getJson(path) {
  const res = await fetch(path);
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok === false) throw Object.assign(new Error(data?.error || `HTTP ${res.status}`), { status: res.status });
  return data;
}

export const fetchRecentCommits = () => getJson("/local/activity/git");
export const fetchClaudeStatusDocs = () => getJson("/local/activity/claude-status");
