/*
  kanbanBridge (client) — fetch wrappers for /local/kanban/*. Same shape as
  hermesBridge.js: same-origin only, server owns the real backend (here: an
  SSH-exec'd CLI, not HTTP — see vite-plugins/kanbanBridge.js). Every
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

export const fetchKanbanStatus = () => getJson("/local/kanban/status");
export const fetchKanbanStats = () => getJson("/local/kanban/stats");
export const fetchKanbanBoards = () => getJson("/local/kanban/boards");
export const fetchKanbanAssignees = () => getJson("/local/kanban/assignees");

export function fetchKanbanList({ status, assignee, archived, sort } = {}) {
  const q = new URLSearchParams();
  if (status) q.set("status", status);
  if (assignee) q.set("assignee", assignee);
  if (archived) q.set("archived", "1");
  if (sort) q.set("sort", sort);
  const qs = q.toString();
  return getJson(`/local/kanban/list${qs ? `?${qs}` : ""}`);
}

export const fetchKanbanTask = (id) => getJson(`/local/kanban/show?id=${encodeURIComponent(id)}`);

export const createKanbanTask = (task) => sendJson("/local/kanban/create", "POST", task);
export const assignKanbanTask = (id, profile) => sendJson("/local/kanban/assign", "PUT", { id, profile });
export const commentKanbanTask = (id, text, author) => sendJson("/local/kanban/comment", "POST", { id, text, author });
export const blockKanbanTask = (id, reason, kind) => sendJson("/local/kanban/block", "POST", { id, reason, kind });
export const unblockKanbanTasks = (ids, reason) => sendJson("/local/kanban/unblock", "POST", { ids, reason });
export const completeKanbanTasks = (ids, result, summary) => sendJson("/local/kanban/complete", "POST", { ids, result, summary });
export const archiveKanbanTasks = (ids) => sendJson("/local/kanban/archive", "POST", { ids });
export const linkKanbanTasks = (parentId, childId) => sendJson("/local/kanban/link", "POST", { parentId, childId });
export const unlinkKanbanTasks = (parentId, childId) => sendJson("/local/kanban/unlink", "POST", { parentId, childId });
