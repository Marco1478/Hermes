/*
  missionBridge — parses real docs/claude/*.md files straight off disk
  (same local-fs pattern as activityBridge.js — this repo IS the Vite
  server's cwd) into structured instruction-file / chunk / status data for
  the Mission Pipeline. No task-status inference beyond what the files
  literally say: a chunk's "done" state is never guessed from vibes, only
  from an explicit status report existing/not for that instruction file.
*/

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

function firstHeading(content) {
  const m = content.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

function parseChunks(content) {
  const chunks = [];
  const re = /^##\s+(CLAUDE-\d+)\s+—\s+(.+)$/gm;
  let match;
  while ((match = re.exec(content))) {
    const [, id, title] = match;
    const bodyStart = match.index + match[0].length;
    const nextMatch = content.slice(bodyStart).search(/^##\s+CLAUDE-\d+\s+—/m);
    const body = nextMatch === -1 ? content.slice(bodyStart) : content.slice(bodyStart, bodyStart + nextMatch);
    const objectiveMatch = body.match(/\*\*Objective:\*\*\s*\n+(.+)/);
    chunks.push({ id, title: title.trim(), objective: objectiveMatch ? objectiveMatch[1].trim() : null });
  }
  return chunks;
}

async function listInstructionFiles(root) {
  const dir = path.join(root, "docs", "claude");
  const files = await readdir(dir);
  const instructionFiles = files.filter((f) => /CLAUDE_INSTRUCTIONS.*\.md$/.test(f));
  return Promise.all(
    instructionFiles.map(async (f) => {
      const full = path.join(dir, f);
      const [content, st] = await Promise.all([readFile(full, "utf8"), stat(full)]);
      return {
        file: f,
        mtime: st.mtime.toISOString(),
        title: firstHeading(content),
        chunks: parseChunks(content),
      };
    })
  );
}

async function listStatusReports(root) {
  const dir = path.join(root, "docs", "claude", "status");
  const files = await readdir(dir);
  return Promise.all(
    files
      .filter((f) => f.endsWith(".md"))
      .map(async (f) => {
        const full = path.join(dir, f);
        const [content, st] = await Promise.all([readFile(full, "utf8"), stat(full)]);
        return {
          file: f,
          mtime: st.mtime.toISOString(),
          title: firstHeading(content),
          // Which CLAUDE-### chunks this report says it responds to /
          // completed, read straight from its own text — not inferred.
          mentionsChunks: [...content.matchAll(/CLAUDE-\d+/g)].map((m) => m[0]).filter((v, i, arr) => arr.indexOf(v) === i),
          isBlocker: /blocker/i.test(f),
        };
      })
  );
}

export function missionBridgePlugin({ projectRoot }) {
  return {
    name: "mission-bridge",
    configureServer(server) {
      const use = (p, handler) => server.middlewares.use(p, handler);

      use("/local/mission/instructions", async (req, res) => {
        try {
          const files = await listInstructionFiles(projectRoot);
          files.sort((a, b) => (a.file < b.file ? 1 : -1));
          sendJson(res, 200, { ok: true, files });
        } catch (err) {
          sendJson(res, 502, { ok: false, error: err.message });
        }
      });

      use("/local/mission/status-reports", async (req, res) => {
        try {
          const reports = await listStatusReports(projectRoot);
          reports.sort((a, b) => (a.mtime < b.mtime ? 1 : -1));
          sendJson(res, 200, { ok: true, reports });
        } catch (err) {
          sendJson(res, 502, { ok: false, error: err.message });
        }
      });
    },
  };
}
