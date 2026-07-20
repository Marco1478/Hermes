/*
  dashboard — client for the dev-only /local/dashboard/* endpoints (see
  vite-plugins/hermesDashboard.js), which proxy to the real Hermes WebUI
  dashboard (session-cookie login, credentials never reach the browser).
  This is the ONLY real way to change Hermes's live model — and it's
  global (every platform Hermes serves), not per-chat.
*/

export async function fetchDashboardStatus() {
  const res = await fetch("/local/dashboard/status");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function setDashboardModel(model, provider) {
  const res = await fetch("/local/dashboard/model", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(provider ? { model, provider } : { model }),
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
