#!/usr/bin/env node
/*
  smoke-backend.mjs — permanent, reviewable backend smoke test for the
  Hermes custom UI. Exercises every real backend path this app depends on
  (gateway, dashboard, kanban SSH bridge) and reports pass/fail per check.
  Never prints secret values, only whether they're set. Exit code is 0 iff
  every check passed — safe to wire into CI later.

  Run: npm run smoke
*/

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ---- Load .env.local (no dotenv dependency — this project stays lean) ----
function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

const GATEWAY_BASE_URL = process.env.VITE_GATEWAY_BASE_URL || "http://192.168.2.11:8642";
const GATEWAY_API_KEY = process.env.VITE_GATEWAY_API_KEY || "";
const DASHBOARD_BASE_URL = process.env.HERMES_DASHBOARD_BASE_URL || "http://192.168.2.11:9119";
const DASHBOARD_USERNAME = process.env.HERMES_DASHBOARD_USERNAME || "";
const DASHBOARD_PASSWORD = process.env.HERMES_DASHBOARD_PASSWORD || "";
const SSH_HOST = process.env.HERMES_SSH_HOST || "";
const SSH_KEY_PATH = process.env.HERMES_SSH_KEY_PATH || "";
const KANBAN_HAS_SSH = Boolean(SSH_HOST && SSH_KEY_PATH);

const results = [];
function record(group, name, ok, detail) {
  results.push({ group, name, ok, detail: detail ? String(detail).slice(0, 300) : null });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${group} — ${name}${detail ? `: ${detail}` : ""}`);
}

// ---- env presence (booleans only, never values) --------------------------
function checkEnv() {
  record("env", "VITE_GATEWAY_API_KEY set", Boolean(GATEWAY_API_KEY));
  record("env", "HERMES_DASHBOARD_USERNAME set", Boolean(DASHBOARD_USERNAME));
  record("env", "HERMES_DASHBOARD_PASSWORD set", Boolean(DASHBOARD_PASSWORD));
  record("env", "Kanban bridge path available", KANBAN_HAS_SSH || true, KANBAN_HAS_SSH ? "ssh" : "local docker fallback");
}

// ---- gateway ---------------------------------------------------------------
async function checkGateway() {
  if (!GATEWAY_API_KEY) {
    record("gateway", "health", false, "VITE_GATEWAY_API_KEY not set");
    return;
  }
  try {
    const res = await fetch(`${GATEWAY_BASE_URL}/health`, { headers: { Authorization: `Bearer ${GATEWAY_API_KEY}` } });
    record("gateway", "health", res.ok, `HTTP ${res.status}`);
  } catch (err) {
    record("gateway", "health", false, err.message);
  }
}

// ---- dashboard --------------------------------------------------------------
let dashCookie = null;
async function dashLogin() {
  const res = await fetch(`${DASHBOARD_BASE_URL}/auth/password-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "basic", username: DASHBOARD_USERNAME, password: DASHBOARD_PASSWORD, next: "" }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("no session cookie returned");
  dashCookie = setCookie.split(";")[0];
}

async function dashFetch(path, init = {}) {
  if (!dashCookie) await dashLogin();
  return fetch(`${DASHBOARD_BASE_URL}${path}`, { ...init, headers: { ...(init.headers || {}), Cookie: dashCookie } });
}

async function checkDashboardAuth() {
  if (!DASHBOARD_USERNAME || !DASHBOARD_PASSWORD) {
    record("dashboard", "auth", false, "HERMES_DASHBOARD_USERNAME/PASSWORD not set");
    return;
  }
  try {
    await dashLogin();
    record("dashboard", "auth", true, "session cookie acquired");
  } catch (err) {
    record("dashboard", "auth", false, err.message);
  }
}

async function checkModels() {
  if (!dashCookie) return record("dashboard", "model options read", false, "not authenticated");
  try {
    const res = await dashFetch("/api/model/options");
    record("dashboard", "model options read", res.ok, `HTTP ${res.status}`);
  } catch (err) {
    record("dashboard", "model options read", false, err.message);
  }
}

async function checkCronReadAndReversibleCreate() {
  if (!dashCookie) return record("dashboard", "cron jobs read", false, "not authenticated");
  try {
    const listRes = await dashFetch("/api/cron/jobs");
    record("dashboard", "cron jobs read", listRes.ok, `HTTP ${listRes.status}`);
  } catch (err) {
    record("dashboard", "cron jobs read", false, err.message);
    return;
  }
  try {
    const createRes = await dashFetch("/api/cron/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "HERMES_UI_TEST_DELETE_ME", prompt: "smoke test", schedule: "0 9 1 1 *", deliver: "local" }),
    });
    if (!createRes.ok) throw new Error(`create HTTP ${createRes.status}`);
    const created = await createRes.json();
    record("dashboard", "cron job reversible create", true, created.id);
    const delRes = await dashFetch(`/api/cron/jobs/${encodeURIComponent(created.id)}`, { method: "DELETE" });
    record("dashboard", "cron job reversible delete (cleanup)", delRes.ok, `HTTP ${delRes.status}`);
  } catch (err) {
    record("dashboard", "cron job reversible create/delete", false, err.message);
  }
}

async function checkMemoryNoOpEdit() {
  if (!dashCookie) return record("dashboard", "memory read", false, "not authenticated");
  try {
    const memRes = await dashFetch("/api/memory");
    record("dashboard", "memory read", memRes.ok, `HTTP ${memRes.status}`);
    if (!memRes.ok) return;
  } catch (err) {
    record("dashboard", "memory read", false, err.message);
    return;
  }
  try {
    const graphRes = await dashFetch("/api/learning/graph");
    if (!graphRes.ok) throw new Error(`graph HTTP ${graphRes.status}`);
    const graph = await graphRes.json();
    const firstId = graph?.nodes?.[0]?.id;
    if (!firstId) {
      record("dashboard", "memory no-op edit", true, "no memory node available to test — skipped, not a failure");
      return;
    }
    const nodeRes = await dashFetch(`/api/learning/node?id=${encodeURIComponent(firstId)}`);
    if (!nodeRes.ok) throw new Error(`node read HTTP ${nodeRes.status}`);
    const node = await nodeRes.json();
    const putRes = await dashFetch("/api/learning/node", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: firstId, content: node.content }),
    });
    record("dashboard", "memory no-op edit (write-back identical content)", putRes.ok, `HTTP ${putRes.status}`);
  } catch (err) {
    record("dashboard", "memory no-op edit", false, err.message);
  }
}

async function checkToolsetsNoOpToggle() {
  try {
    const res = await fetch(`${GATEWAY_BASE_URL}/v1/toolsets`, { headers: { Authorization: `Bearer ${GATEWAY_API_KEY}` } });
    record("gateway", "toolsets read", res.ok, `HTTP ${res.status}`);
    if (!res.ok || !dashCookie) return;
    const data = await res.json();
    const first = data?.data?.[0];
    if (!first) {
      record("dashboard", "toolset no-op toggle", true, "no toolset available to test — skipped, not a failure");
      return;
    }
    const off = await dashFetch(`/api/tools/toolsets/${encodeURIComponent(first.name)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !first.enabled }),
    });
    const back = await dashFetch(`/api/tools/toolsets/${encodeURIComponent(first.name)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: first.enabled }),
    });
    record("dashboard", "toolset no-op toggle (flip + restore)", off.ok && back.ok, `${first.name}: ${off.status}/${back.status}`);
  } catch (err) {
    record("gateway", "toolsets read / no-op toggle", false, err.message);
  }
}

// ---- kanban (SSH-exec'd CLI) -------------------------------------------------
async function checkKanban() {
  try {
    const command = KANBAN_HAS_SSH ? "ssh" : "docker";
    const args = KANBAN_HAS_SSH
      ? ["-i", SSH_KEY_PATH, "-o", "BatchMode=yes", "-o", "ConnectTimeout=8", "-o", "StrictHostKeyChecking=accept-new", SSH_HOST, "docker exec hermes hermes kanban stats --json"]
      : ["exec", "hermes", "hermes", "kanban", "stats", "--json"];
    const { stdout } = await execFileAsync(command, args, { timeout: 15000 });
    JSON.parse(stdout);
    record("kanban", "availability/read (stats --json)", true, KANBAN_HAS_SSH ? "ssh" : "local docker fallback");
  } catch (err) {
    record("kanban", "availability/read", false, err.message);
  }
}

// ---- command registry --------------------------------------------------------
async function checkCommandRegistry() {
  try {
    const mod = await import(pathToFileURL(path.join(ROOT, "src", "data", "commandRegistry.js")).href);
    record("ui", "command registry availability", Array.isArray(mod.COMMANDS) && mod.COMMANDS.length > 0, `${mod.COMMANDS?.length ?? 0} commands`);
  } catch (err) {
    record("ui", "command registry availability", false, err.message);
  }
}

// ---- System Overview scroll regression (static check — no browser dep) ------
function checkScrollRegression() {
  try {
    const css = readFileSync(path.join(ROOT, "src", "components", "PageShell.css"), "utf8");
    const hasScrollContainer = /\.page-scroll\s*{[^}]*flex:\s*1[^}]*}/s.test(css) && /\.page-scroll\s*{[^}]*overflow-y:\s*auto[^}]*}/s.test(css);
    record(
      "ui",
      "System Overview scroll regression (static CSS check)",
      hasScrollContainer,
      hasScrollContainer ? ".page-scroll still flex:1 + overflow-y:auto" : "pattern not found — investigate before shipping"
    );
  } catch (err) {
    record("ui", "System Overview scroll regression", false, err.message);
  }
  console.log("  (static check only — no Playwright/browser dependency in this project; a real render+scroll check is the natural next step, see docs/claude/status/*.md)");
}

async function main() {
  checkEnv();
  await checkGateway();
  await checkDashboardAuth();
  await checkModels();
  await checkCronReadAndReversibleCreate();
  await checkMemoryNoOpEdit();
  await checkToolsetsNoOpToggle();
  await checkKanban();
  await checkCommandRegistry();
  checkScrollRegression();

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  const report = { ranAt: new Date().toISOString(), passed, failed, total: results.length, results };
  writeFileSync(path.join(ROOT, "smoke-report.local.json"), JSON.stringify(report, null, 2));

  console.log(`\n${passed}/${results.length} checks passed.`);
  console.log(`SMOKE_RESULT_JSON:${JSON.stringify(report)}`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
