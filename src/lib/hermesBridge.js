/*
  hermesBridge (client) — the only way React touches Hermes data outside
  chat. Every function calls a same-origin /local/hermes/* endpoint (see
  vite-plugins/hermesBridge.js); React never knows or cares whether the
  answer came from the gateway, the dashboard, or a static fallback — the
  bridge says so honestly via each response's `source`/`warning` fields
  where relevant.
*/

async function getJson(path) {
  const res = await fetch(path);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(data?.error || `HTTP ${res.status}`), { status: res.status });
  return data;
}

export const fetchHermesHealth = () => getJson("/local/hermes/health");
export const fetchHermesDetailedHealth = () => getJson("/local/hermes/health/detailed");
export const fetchHermesCapabilities = () => getJson("/local/hermes/capabilities");
export const fetchHermesSkills = () => getJson("/local/hermes/skills");
export const fetchHermesToolsets = () => getJson("/local/hermes/toolsets");
export const fetchHermesSessions = () => getJson("/local/hermes/sessions");
export const fetchHermesJobs = () => getJson("/local/hermes/jobs");
export const fetchHermesModels = () => getJson("/local/hermes/models");
export const fetchDashboardStatus = () => getJson("/local/hermes/dashboard/status");
export const fetchAnalyticsUsage = () => getJson("/local/hermes/analytics/usage");
export const fetchAnalyticsModels = () => getJson("/local/hermes/analytics/models");
export const fetchSystemStats = () => getJson("/local/hermes/system/stats");
export const fetchMessagingPlatforms = () => getJson("/local/hermes/messaging/platforms");
export const fetchHermesConfig = () => getJson("/local/hermes/config");
export const fetchHermesProfiles = () => getJson("/local/hermes/profiles");
export const fetchHermesMemory = () => getJson("/local/hermes/memory");
export const fetchHermesLearningGraph = () => getJson("/local/hermes/learning/graph");
export const fetchHermesMcpServers = () => getJson("/local/hermes/mcp/servers");
export const fetchCronJobs = () => getJson("/local/hermes/cron/jobs");
export const fetchLearningNode = (id) => getJson(`/local/hermes/learning/node?id=${encodeURIComponent(id)}`);
export const fetchProfileSoul = (name = "default") => getJson(`/local/hermes/profiles/soul?name=${encodeURIComponent(name)}`);
export const fetchSkillsFull = () => getJson("/local/hermes/skills/full");

async function postAction(path) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    /* non-JSON */
  }
  if (!res.ok) throw new Error(data?.error || data?.detail || `HTTP ${res.status}`);
  return data;
}

export const restartGateway = () => postAction("/local/hermes/gateway/restart");
export const pauseCronJob = (id) => postAction(`/local/hermes/cron/pause?id=${encodeURIComponent(id)}`);
export const resumeCronJob = (id) => postAction(`/local/hermes/cron/resume?id=${encodeURIComponent(id)}`);
export const triggerCronJob = (id) => postAction(`/local/hermes/cron/trigger?id=${encodeURIComponent(id)}`);

export async function saveProfileSoul(name, content) {
  const res = await fetch(`/local/hermes/profiles/soul?name=${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) throw new Error(data?.error || data?.detail || `HTTP ${res.status}`);
  return data;
}

async function putJson(path, body) {
  const res = await fetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) throw new Error(data?.error || data?.detail || `HTTP ${res.status}`);
  return data;
}

export const updateCronJob = (id, updates) => putJson(`/local/hermes/cron/update?id=${encodeURIComponent(id)}`, updates);
export const toggleSkill = (name, enabled) => putJson("/local/hermes/skills/toggle", { name, enabled });

async function requestJson(path, method, body) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) throw new Error(data?.error || data?.detail || `HTTP ${res.status}`);
  return data;
}

const postJson = (path, body) => requestJson(path, "POST", body);
const deleteJson = (path, body) => requestJson(path, "DELETE", body);

/* Memory/skill node CRUD — real /api/learning/node has no create, only
   edit + delete (verified against agent/learning_mutations.py). */
export const updateLearningNode = (id, content) => putJson("/local/hermes/learning/node", { id, content });
export const deleteLearningNode = (id) => deleteJson("/local/hermes/learning/node", { id });

export const createCronJob = (job) => postJson("/local/hermes/cron/create", job);
export const toggleToolset = (name, enabled) => putJson(`/local/hermes/toolsets/toggle?name=${encodeURIComponent(name)}`, { enabled });
export const toggleMcpServer = (name, enabled) =>
  putJson(`/local/hermes/mcp/servers/toggle?name=${encodeURIComponent(name)}`, { enabled });

export async function setHermesModel({ provider, model }) {
  const res = await fetch("/local/hermes/model/set", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, model }),
  });
  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    const detail = data?.error || data?.detail || raw.slice(0, 200) || `HTTP ${res.status}`;
    throw new Error(detail);
  }
  return data;
}
