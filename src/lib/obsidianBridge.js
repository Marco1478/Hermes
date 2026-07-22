/*
  obsidianBridge (client) — fetch wrappers for /local/obsidian/*. Same
  shape as kanbanBridge.js: same-origin only, server owns the real backend
  (SSH-exec'd filesystem inside the Hermes container, not HTTP — see
  vite-plugins/obsidianBridge.js). Every response carries `ok`; callers
  check it instead of assuming shape.
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

export const fetchObsidianStatus = () => getJson("/local/obsidian/status");

export const fetchVaultNotes = (archived = false) => getJson(`/local/obsidian/notes/list${archived ? "?archived=1" : ""}`);
export const readVaultNote = (id) => getJson(`/local/obsidian/notes/read?path=${encodeURIComponent(id)}`);
export const writeVaultNote = (id, note) => sendJson("/local/obsidian/notes/write", "POST", { id, note });
export const archiveVaultNote = (id) => sendJson("/local/obsidian/notes/archive", "POST", { id });
export const unarchiveVaultNote = (id) => sendJson("/local/obsidian/notes/unarchive", "POST", { id });

export const fetchVaultProjects = (archived = false) => getJson(`/local/obsidian/projects/list${archived ? "?archived=1" : ""}`);
export const writeVaultProject = (id, project) => sendJson("/local/obsidian/projects/write", "POST", { id, project });
export const archiveVaultProject = (id) => sendJson("/local/obsidian/projects/archive", "POST", { id });
export const unarchiveVaultProject = (id) => sendJson("/local/obsidian/projects/unarchive", "POST", { id });
