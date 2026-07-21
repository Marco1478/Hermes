/*
  missionBridge (client) — reads for the Mission Pipeline, served by
  vite-plugins/missionBridge.js off the real docs/claude/*.md files.
*/
async function getJson(path) {
  const res = await fetch(path);
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok === false) throw Object.assign(new Error(data?.error || `HTTP ${res.status}`), { status: res.status });
  return data;
}

export const fetchMissionInstructions = () => getJson("/local/mission/instructions");
export const fetchMissionStatusReports = () => getJson("/local/mission/status-reports");
