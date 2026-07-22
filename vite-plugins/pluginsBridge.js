/*
  pluginsBridge — real Hermes plugin management for the server-side Vite
  bridge, same shape as kanbanBridge.js (see that file's header for the full
  rationale — SSH-exec'd CLI, shell-quoted args, JSON reads vs text writes).

  No dashboard/gateway HTTP surface exists for plugins — confirmed live via
  `hermes plugins --help` on the box: install/update/remove/list/enable/
  disable, `list --json` for structured output, enable/disable print a
  short confirmation line instead. Same SSH bridge as Kanban (same box, same
  container, same env vars) — HERMES_SSH_HOST / HERMES_SSH_KEY_PATH.

  Scope: this bridge only wires list/enable/disable (the ones a toggle UI
  can drive safely and non-interactively). `install`/`update`/`remove` are
  deliberately NOT exposed here — install can shell out to git against an
  arbitrary user-supplied identifier, and both remove and install are much
  harder to make safely reversible from a web toggle than flipping a
  boolean; those stay CLI-only for now rather than being faked as buttons.
*/

import { execFile } from "node:child_process";

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function buildRemoteCommand(args) {
  return ["docker", "exec", "hermes", "hermes", "plugins", ...args].map(shQuote).join(" ");
}

export function createPluginsExec({ sshHost, sshKeyPath, timeoutMs = 20000 }) {
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
        : ["exec", "hermes", "hermes", "plugins", ...args];
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
    if (!result.ok) return { ok: false, error: result.stderr || "plugins command failed" };
    try {
      return { ok: true, data: JSON.parse(result.stdout) };
    } catch {
      return { ok: false, error: `Non-JSON output from plugins CLI: ${(result.stdout || result.stderr).slice(0, 400)}` };
    }
  }

  /* Writes: CLI prints a short human confirmation line, not JSON. Surface it
     as text rather than fake a structured success payload. */
  async function runText(args) {
    const result = await run(args);
    if (!result.ok) return { ok: false, error: result.stderr || "plugins command failed" };
    return { ok: true, message: result.stdout.trim() };
  }

  return { configured, run, runJson, runText };
}
