/*
  activityBridge — local, read-only sources for the Agent Activity Center:
  git commits and docs/claude status reports. Both live on disk right next
  to the Vite dev server itself (no SSH needed, unlike kanbanBridge.js —
  this repo IS the working directory Vite runs from), so this is a plain
  child_process.execFile + fs.readdir, not a remote exec.
*/

import { execFile } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

function gitLog(cwd, count = 20) {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["log", `-${count}`, "--pretty=format:%H%x1f%an%x1f%ad%x1f%s", "--date=iso-strict"],
      { cwd, maxBuffer: 2 * 1024 * 1024 },
      (err, stdout) => {
        if (err) {
          resolve({ ok: false, error: err.message });
          return;
        }
        const commits = stdout
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const [hash, author, date, subject] = line.split("\x1f");
            return { hash: hash?.slice(0, 9), author, date, subject };
          });
        resolve({ ok: true, commits });
      }
    );
  });
}

async function listStatusDocs(root) {
  const dir = path.join(root, "docs", "claude", "status");
  try {
    const files = await readdir(dir);
    const entries = await Promise.all(
      files
        .filter((f) => f.endsWith(".md"))
        .map(async (f) => {
          const full = path.join(dir, f);
          const st = await stat(full);
          return { file: f, mtime: st.mtime.toISOString() };
        })
    );
    entries.sort((a, b) => (a.mtime < b.mtime ? 1 : -1));
    return { ok: true, docs: entries };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export function activityBridgePlugin({ projectRoot }) {
  return {
    name: "activity-bridge",
    configureServer(server) {
      const use = (p, handler) => server.middlewares.use(p, handler);

      use("/local/activity/git", async (req, res) => {
        const result = await gitLog(projectRoot);
        sendJson(res, result.ok ? 200 : 502, result);
      });

      use("/local/activity/claude-status", async (req, res) => {
        const result = await listStatusDocs(projectRoot);
        sendJson(res, result.ok ? 200 : 502, result);
      });
    },
  };
}
