/*
  pluginsBridge (client) — fetch wrappers for /local/plugins/*. Same shape
  as kanbanBridge.js: same-origin only, server owns the real backend (here:
  an SSH-exec'd CLI, not HTTP — see vite-plugins/pluginsBridge.js). Every
  response carries `ok`; callers check it instead of assuming shape.
*/

async function getJson(path) {
  const res = await fetch(path);
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.ok === false) throw Object.assign(new Error(data?.error || `HTTP ${res.status}`), { status: res.status });
  return data;
}

async function sendJson(path, method, body) {
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
  if (!res.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export const fetchPluginsStatus = () => getJson("/local/plugins/status");
export const fetchPluginsList = () => getJson("/local/plugins/list");
export const enablePlugin = (name) => sendJson("/local/plugins/enable", "POST", { name });
export const disablePlugin = (name) => sendJson("/local/plugins/disable", "POST", { name });
