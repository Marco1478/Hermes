/*
  kanbanBridge — real Hermes Kanban access for the server-side Vite bridge.

  There is no dashboard/gateway HTTP surface for Kanban (verified: grepping
  /opt/hermes/hermes_cli/web_server.py for "kanban" only turns up an
  unrelated auxiliary-model name and a docstring). The only real backend is
  the CLI inside the Hermes container (`hermes kanban ...`, `--json`
  supported on every read verb — confirmed live: list/show/stats/boards
  list/assignees all print structured JSON with --json).

  This box isn't reachable from Node's fetch() the way the gateway/dashboard
  are — it's exec'd over the same SSH bridge documented in the repo's
  CLAUDE.md (key at HERMES_SSH_KEY_PATH, host HERMES_SSH_HOST, both
  server-only env vars — never exposed to the client bundle).

  Sanitization: every task id / title / comment / reason is shell-quoted
  (POSIX single-quote wrapping with '\'' escaping for embedded quotes)
  before being joined into the ONE command string ssh sends to the remote
  shell. ssh does not preserve argv boundaries across the wire — it joins
  whatever argv it's given with spaces and hands the result to the remote
  user's shell to parse — so passing user text as separate execFile()
  arguments is not enough by itself; each token must be quoted for POSIX
  shell here, not just passed as a separate array entry.
*/

import { execFile } from "node:child_process";

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function buildRemoteCommand(args) {
  return ["docker", "exec", "hermes", "hermes", "kanban", ...args].map(shQuote).join(" ");
}

export function createKanbanExec({ sshHost, sshKeyPath, timeoutMs = 15000 }) {
  const hasSsh = Boolean(sshHost && sshKeyPath);
  const configured = true; // SSH if configured, otherwise local Docker CLI fallback in the Hermes container.

  function run(args) {
    return new Promise((resolve) => {
      const command = hasSsh ? "ssh" : "docker";
      const argv = hasSsh
        ? [
            "-i",
            sshKeyPath,
            "-o",
            "BatchMode=yes",
            "-o",
            "ConnectTimeout=8",
            "-o",
            "StrictHostKeyChecking=accept-new",
            sshHost,
            buildRemoteCommand(args),
          ]
        : ["exec", "hermes", "hermes", "kanban", ...args];
      execFile(command, argv, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
          resolve({ ok: false, stdout: stdout || "", stderr: (stderr || err.message || "").trim() });
          return;
        }
        resolve({ ok: true, stdout: stdout || "", stderr: (stderr || "").trim() });
      });
    });
  }

  /* Reads: expect --json on stdout. Non-JSON stdout (crash trace, argparse
     error) is surfaced verbatim as the error detail rather than silently
     swallowed. */
  async function runJson(args) {
    const result = await run(args);
    if (!result.ok) return { ok: false, error: result.stderr || "kanban command failed" };
    try {
      return { ok: true, data: JSON.parse(result.stdout) };
    } catch {
      return { ok: false, error: `Non-JSON output from kanban CLI: ${(result.stdout || result.stderr).slice(0, 400)}` };
    }
  }

  /* Writes: CLI prints a short human confirmation line, not JSON. Surface it
     as text rather than fake a structured success payload. */
  async function runText(args) {
    const result = await run(args);
    if (!result.ok) return { ok: false, error: result.stderr || "kanban command failed" };
    return { ok: true, message: result.stdout.trim() };
  }

  return { configured, run, runJson, runText };
}
