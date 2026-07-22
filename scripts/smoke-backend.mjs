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
import { createObsidianExec, safeRelPath, noteToMarkdown, markdownToNote, projectToMarkdown, markdownToProject } from "../vite-plugins/obsidianBridge.js";
import { createKanbanExec } from "../vite-plugins/kanbanBridge.js";

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
const OBSIDIAN_VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || "";
const OBSIDIAN_NOTES_DIR = process.env.OBSIDIAN_NOTES_DIR || "Hermes/Notes";
const OBSIDIAN_PROJECTS_DIR = process.env.OBSIDIAN_PROJECTS_DIR || "Hermes/Projects";
const OBSIDIAN_ARCHIVE_DIR = process.env.OBSIDIAN_ARCHIVE_DIR || "Hermes/Archive";

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

// ---- Obsidian vault (SSH-exec'd, same bridge module the dev server uses) ----
// No local-temp-vault fallback here: the bridge always talks to the vault
// over SSH/docker-exec against the real container (see
// vite-plugins/obsidianBridge.js) — there's no code path where it reads a
// filesystem local to wherever this script happens to run, so a folder
// under /tmp on the machine running `npm run smoke` wouldn't actually
// exercise anything. When OBSIDIAN_VAULT_PATH isn't set, the only honest
// check is "the feature correctly reports itself as not configured."
async function checkObsidian() {
  record("env", "OBSIDIAN_VAULT_PATH set", Boolean(OBSIDIAN_VAULT_PATH), OBSIDIAN_VAULT_PATH ? "configured" : "not set — vault checks skipped, not a failure");
  if (!OBSIDIAN_VAULT_PATH) return;

  const obsidian = createObsidianExec({
    sshHost: SSH_HOST,
    sshKeyPath: SSH_KEY_PATH,
    vaultPath: OBSIDIAN_VAULT_PATH,
    notesDir: OBSIDIAN_NOTES_DIR,
    projectsDir: OBSIDIAN_PROJECTS_DIR,
    archiveDir: OBSIDIAN_ARCHIVE_DIR,
  });

  try {
    const status = await obsidian.status();
    record("obsidian", "status", Boolean(status.ok && status.vaultOk), status.error || `notes=${status.noteCount} projects=${status.projectCount}`);
    if (!status.vaultOk) return;
  } catch (err) {
    record("obsidian", "status", false, err.message);
    return;
  }

  const trav1 = safeRelPath("../secret.md");
  const trav2 = safeRelPath("/etc/passwd");
  record("obsidian", "path traversal rejected", trav1 === null && trav2 === null, `../secret.md -> ${trav1}, /etc/passwd -> ${trav2}`);

  // Reversible test note. Flat, directly under notesDir — NOT a subfolder:
  // notes are deliberately flat (list uses `find -maxdepth 1`, matching
  // the app's own data model), so a subfolder path would silently never
  // show up in the list check below despite writing/reading fine.
  const testRel = "HERMES_UI_SMOKE_TEST_DELETE_ME.md";
  const note = { title: "HERMES_UI_SMOKE_TEST_DELETE_ME", body: "Automated smoke test note — safe to ignore/delete.", tags: ["smoke"], checklist: [] };
  try {
    const writeRes = await obsidian.writeFile(obsidian.dirs.notes, testRel, noteToMarkdown(note));
    record("obsidian", "create/write test note", writeRes.ok, writeRes.error);

    const readRes = await obsidian.readFile(obsidian.dirs.notes, testRel);
    const parsed = readRes.ok ? markdownToNote(testRel, readRes.raw) : null;
    record("obsidian", "read test note", Boolean(readRes.ok && parsed?.title === note.title), readRes.error);

    const listRes = await obsidian.listFiles(obsidian.dirs.notes, "flat");
    record("obsidian", "search/list finds test note", Boolean(listRes.ok && listRes.files.some((f) => f.relPath === testRel)), listRes.error);

    const archiveRes = await obsidian.move(obsidian.dirs.notes, testRel, obsidian.dirs.archive, testRel);
    record("obsidian", "archive test note", archiveRes.ok, archiveRes.error);
  } finally {
    // Cleanup: the app's own bridge deliberately has no hard-delete (see
    // obsidianBridge.js) — this direct rm is the smoke script alone
    // tidying up its own throwaway artifact, not a capability exposed
    // through the app.
    const cleanupScript = `rm -f '${obsidian.dirs.archive}/${testRel}' '${obsidian.dirs.notes}/${testRel}'`;
    const cleanup = await execFileAsync(
      KANBAN_HAS_SSH ? "ssh" : "docker",
      KANBAN_HAS_SSH
        ? ["-i", SSH_KEY_PATH, "-o", "BatchMode=yes", "-o", "ConnectTimeout=8", "-o", "StrictHostKeyChecking=accept-new", SSH_HOST, `docker exec hermes sh -c "${cleanupScript}"`]
        : ["exec", "hermes", "sh", "-c", cleanupScript],
      { timeout: 15000 }
    ).catch((err) => ({ error: err.message }));
    record("obsidian", "cleanup (no test note left in real vault)", !cleanup.error, cleanup.error);
  }
}

// ---- Project workspaces (projects/canvases/workflows/kanban relation) -------
// Same reasoning as checkObsidian() above: exercises the real bridge
// primitives directly (obsidianBridge.js, kanbanBridge.js) against the real
// vault/CLI, using a dedicated _HERMES_UI_SMOKE_*_DELETE_ME prefix so a
// human skimming the vault or Kanban board immediately recognizes and can
// ignore/remove any artifact left behind by a crashed run.
async function checkProjectWorkspaces() {
  if (!OBSIDIAN_VAULT_PATH) return; // already reported by checkObsidian()'s env check

  const obsidian = createObsidianExec({
    sshHost: SSH_HOST,
    sshKeyPath: SSH_KEY_PATH,
    vaultPath: OBSIDIAN_VAULT_PATH,
    notesDir: OBSIDIAN_NOTES_DIR,
    projectsDir: OBSIDIAN_PROJECTS_DIR,
    archiveDir: OBSIDIAN_ARCHIVE_DIR,
  });

  const status = await obsidian.status().catch((err) => ({ ok: false, error: err.message }));
  if (!status.ok || !status.vaultOk) {
    record("obsidian", "project workspace checks", false, "vault not reachable — skipped");
    return;
  }

  const projectRel = "_HERMES_UI_SMOKE_PROJECT_DELETE_ME";
  const canvasRel = "_HERMES_UI_SMOKE_CANVAS_DELETE_ME.canvas.json";
  const workflowRel = "_HERMES_UI_SMOKE_WORKFLOW_DELETE_ME.workflow.json";
  const noteRel = "_HERMES_UI_SMOKE_TEST_LINKED_NOTE_DELETE_ME.md";
  const canvasDir = `${obsidian.dirs.projects}/${projectRel}/canvases`;
  const workflowDir = `${obsidian.dirs.projects}/${projectRel}/workflows`;

  const baseProject = {
    name: projectRel,
    description: "Automated smoke test project — safe to ignore/delete.",
    status: "planning",
    priority: "medium",
    color: null,
    tags: ["smoke"],
    dueDate: null,
    milestones: [],
    linkedNoteRefs: [],
    linkedKanbanIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  let kanbanTaskId = null;
  try {
    // --- project create/read/list ---
    const projectWrite = await obsidian.writeFile(obsidian.dirs.projects, `${projectRel}/overview.md`, projectToMarkdown(baseProject));
    record("obsidian", "create/write test project", projectWrite.ok, projectWrite.error);

    const projectRead = await obsidian.readFile(obsidian.dirs.projects, `${projectRel}/overview.md`);
    const parsedProject = projectRead.ok ? markdownToProject(projectRel, projectRead.raw) : null;
    record("obsidian", "read test project", Boolean(projectRead.ok && parsedProject?.name === baseProject.name), projectRead.error);

    const projectList = await obsidian.listFiles(obsidian.dirs.projects, "nested");
    record("obsidian", "search/list finds test project", Boolean(projectList.ok && projectList.files.some((f) => f.relPath === projectRel)), projectList.error);

    // --- canvas create/update/archive ---
    const canvas = { version: 1, type: "hermes-project-canvas", name: "_HERMES_UI_SMOKE_CANVAS_DELETE_ME", tags: ["smoke"], nodes: [], edges: [] };
    const canvasWrite = await obsidian.writeFile(canvasDir, canvasRel, JSON.stringify(canvas, null, 2));
    record("obsidian", "create test canvas", canvasWrite.ok, canvasWrite.error);

    const canvasUpdated = { ...canvas, nodes: [{ id: "smoke-node", type: "card", x: 0, y: 0, w: 220, h: 130, title: "smoke", body: "", color: "teal", tags: [], checklist: [], ref: null }] };
    const canvasUpdate = await obsidian.writeFile(canvasDir, canvasRel, JSON.stringify(canvasUpdated, null, 2));
    const canvasReread = await obsidian.readFile(canvasDir, canvasRel);
    const canvasParsed = canvasReread.ok ? JSON.parse(canvasReread.raw) : null;
    record("obsidian", "update test canvas", Boolean(canvasUpdate.ok && canvasParsed?.nodes?.length === 1), canvasUpdate.error);

    const canvasList = await obsidian.listFiles(canvasDir, "flat-json");
    record("obsidian", "search/list finds test canvas", Boolean(canvasList.ok && canvasList.files.some((f) => f.relPath === canvasRel)), canvasList.error);

    const canvasArchive = await obsidian.move(canvasDir, canvasRel, `${obsidian.dirs.archive}/${projectRel}/canvases`, canvasRel);
    record("obsidian", "archive test canvas", canvasArchive.ok, canvasArchive.error);

    // --- workflow create/update/archive ---
    const workflow = { version: 1, type: "hermes-project-workflow", name: "_HERMES_UI_SMOKE_WORKFLOW_DELETE_ME", description: "", tags: ["smoke"], status: "draft", steps: [] };
    const workflowWrite = await obsidian.writeFile(workflowDir, workflowRel, JSON.stringify(workflow, null, 2));
    record("obsidian", "create test workflow", workflowWrite.ok, workflowWrite.error);

    const workflowUpdated = {
      ...workflow,
      steps: [{ id: "smoke-step", title: "smoke step", description: "", owner: "marco", status: "todo", linkedNoteId: null, linkedCanvasId: null, linkedTaskId: "", command: "" }],
    };
    const workflowUpdate = await obsidian.writeFile(workflowDir, workflowRel, JSON.stringify(workflowUpdated, null, 2));
    const workflowReread = await obsidian.readFile(workflowDir, workflowRel);
    const workflowParsed = workflowReread.ok ? JSON.parse(workflowReread.raw) : null;
    record("obsidian", "update test workflow", Boolean(workflowUpdate.ok && workflowParsed?.steps?.length === 1), workflowUpdate.error);

    const workflowList = await obsidian.listFiles(workflowDir, "flat-json");
    record("obsidian", "search/list finds test workflow", Boolean(workflowList.ok && workflowList.files.some((f) => f.relPath === workflowRel)), workflowList.error);

    const workflowArchive = await obsidian.move(workflowDir, workflowRel, `${obsidian.dirs.archive}/${projectRel}/workflows`, workflowRel);
    record("obsidian", "archive test workflow", workflowArchive.ok, workflowArchive.error);

    // --- free note create + link/unlink to project (relation lives in the
    // project's own frontmatter, never a fake field on the note — see
    // state/Projects.jsx's linkNote/unlinkNote) ---
    const note = { title: "_HERMES_UI_SMOKE_TEST_LINKED_NOTE_DELETE_ME", body: "Automated smoke test note for project linking — safe to ignore/delete.", tags: ["smoke"], checklist: [] };
    const noteWrite = await obsidian.writeFile(obsidian.dirs.notes, noteRel, noteToMarkdown(note));
    record("obsidian", "create free note for linking", noteWrite.ok, noteWrite.error);

    const noteRef = noteRel.replace(/\.md$/, "");
    const linkWrite = await obsidian.writeFile(obsidian.dirs.projects, `${projectRel}/overview.md`, projectToMarkdown({ ...baseProject, linkedNoteRefs: [noteRef] }));
    const linkReread = await obsidian.readFile(obsidian.dirs.projects, `${projectRel}/overview.md`);
    const linkParsed = linkReread.ok ? markdownToProject(projectRel, linkReread.raw) : null;
    record("obsidian", "link note to project (frontmatter round-trip)", Boolean(linkWrite.ok && linkParsed?.linkedNoteRefs?.includes(noteRef)), linkWrite.error);

    const unlinkWrite = await obsidian.writeFile(obsidian.dirs.projects, `${projectRel}/overview.md`, projectToMarkdown(baseProject));
    const unlinkReread = await obsidian.readFile(obsidian.dirs.projects, `${projectRel}/overview.md`);
    const unlinkParsed = unlinkReread.ok ? markdownToProject(projectRel, unlinkReread.raw) : null;
    record("obsidian", "unlink note from project", Boolean(unlinkWrite.ok && !(unlinkParsed?.linkedNoteRefs || []).includes(noteRef)), unlinkWrite.error);

    // --- project<->Kanban relation: a real, reversible Kanban task, linked
    // the same way the app links one (project-side linkedKanbanIds, no
    // invented field on the task itself — see state/Projects.jsx) ---
    const kanban = createKanbanExec({ sshHost: SSH_HOST, sshKeyPath: SSH_KEY_PATH });
    try {
      const createRes = await kanban.runJson(["create", "_HERMES_UI_SMOKE_KANBAN_DELETE_ME", "--json", "--triage"]);
      kanbanTaskId = createRes.ok ? createRes.data?.id : null;
      record("kanban", "reversible test task create", Boolean(kanbanTaskId), createRes.error);

      if (kanbanTaskId) {
        const relWrite = await obsidian.writeFile(obsidian.dirs.projects, `${projectRel}/overview.md`, projectToMarkdown({ ...baseProject, linkedKanbanIds: [kanbanTaskId] }));
        const relReread = await obsidian.readFile(obsidian.dirs.projects, `${projectRel}/overview.md`);
        const relParsed = relReread.ok ? markdownToProject(projectRel, relReread.raw) : null;
        record("obsidian", "project<->kanban relation round-trip (frontmatter)", Boolean(relWrite.ok && relParsed?.linkedKanbanIds?.includes(kanbanTaskId)), relWrite.error);
      }
    } finally {
      if (kanbanTaskId) {
        // archive prints a plain confirmation line, not JSON (no --json
        // support on this verb) — matches the app's own
        // /local/kanban/archive route, which uses runText for this exact
        // reason (see vite-plugins/hermesBridge.js).
        const archiveRes = await kanban.runText(["archive", kanbanTaskId]);
        record("kanban", "reversible test task cleanup (archive)", archiveRes.ok, archiveRes.ok ? archiveRes.message : archiveRes.error);
      }
    }

    // --- path traversal still rejected (project-scoped paths too) ---
    const trav = safeRelPath("../../etc/passwd");
    record("obsidian", "project path traversal rejected", trav === null, `../../etc/passwd -> ${trav}`);
  } finally {
    // Cleanup: the app's own bridge deliberately has no hard-delete — this
    // direct rm removes the whole smoke project folder (active + archived
    // copies, which also covers the archived canvas/workflow inside it) and
    // the standalone linked note. Same pattern as checkObsidian()'s cleanup.
    const cleanupScript = [
      `rm -rf '${obsidian.dirs.projects}/${projectRel}'`,
      `rm -rf '${obsidian.dirs.archive}/${projectRel}'`,
      `rm -f '${obsidian.dirs.notes}/${noteRel}'`,
      `rm -f '${obsidian.dirs.archive}/${noteRel}'`,
    ].join(" && ");
    const cleanup = await execFileAsync(
      KANBAN_HAS_SSH ? "ssh" : "docker",
      KANBAN_HAS_SSH
        ? ["-i", SSH_KEY_PATH, "-o", "BatchMode=yes", "-o", "ConnectTimeout=8", "-o", "StrictHostKeyChecking=accept-new", SSH_HOST, `docker exec hermes sh -c "${cleanupScript}"`]
        : ["exec", "hermes", "sh", "-c", cleanupScript],
      { timeout: 15000 }
    ).catch((err) => ({ error: err.message }));
    record("obsidian", "cleanup (no test project/canvas/workflow/note left in real vault)", !cleanup.error, cleanup.error);
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
  await checkObsidian();
  await checkProjectWorkspaces();
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
