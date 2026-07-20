import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";

/*
  claudeUsagePlugin — a dev-only middleware that exposes REAL Anthropic /
  Claude Code usage read from this machine's local transcript logs
  (the .jsonl files under ~/.claude/projects, searched recursively). Each
  assistant line carries a
  `message.usage` block ({input_tokens, output_tokens,
  cache_creation_input_tokens, cache_read_input_tokens}) and a top-level
  `timestamp` — we sum tokens over a rolling 5-hour window and a rolling
  7-day window. Synthetic (<synthetic>) entries carry zero usage and are
  skipped.

  Served at GET /local/claude-usage. Browser same-origin, no CORS issues.
  This is real data, not simulated — if there are no recent Claude
  sessions the numbers are simply zero.
*/

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const STALE_FILE_MS = 8 * 24 * 60 * 60 * 1000; /* ignore files untouched > 8d */

/* Cache parsed per-file token events, keyed by path, invalidated by
   mtime+size so a growing/changed transcript is re-read but stable ones
   are not. Events are {ts:number, tokens:number}. */
const fileCache = new Map();

function projectsDir() {
  return path.join(os.homedir(), ".claude", "projects");
}

function listJsonlFiles(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      listJsonlFiles(full, out);
    } else if (e.isFile() && e.name.endsWith(".jsonl")) {
      out.push(full);
    }
  }
}

async function parseFile(file) {
  const events = [];
  const stream = fs.createReadStream(file, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line || line.indexOf('"usage"') === -1) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const msg = obj?.message;
    const usage = msg?.usage;
    if (!usage || msg?.role !== "assistant") continue;
    if (msg?.model === "<synthetic>") continue;
    const ts = Date.parse(obj?.timestamp || "");
    if (Number.isNaN(ts)) continue;
    /* Exclude cache_read_input_tokens: they're the cheap re-read of an
       already-cached context every turn and utterly dominate the raw sum
       (billions/week), drowning out real consumption. input + output +
       cache_creation is the honest "work done" signal. */
    const tokens =
      (usage.input_tokens || 0) +
      (usage.output_tokens || 0) +
      (usage.cache_creation_input_tokens || 0);
    if (tokens > 0) events.push({ ts, tokens });
  }
  return events;
}

async function collectEvents() {
  const files = [];
  listJsonlFiles(projectsDir(), files);
  const now = Date.now();
  const all = [];
  for (const file of files) {
    let stat;
    try {
      stat = fs.statSync(file);
    } catch {
      continue;
    }
    if (now - stat.mtimeMs > STALE_FILE_MS) continue; /* too old to matter */
    const cacheKey = file;
    const cached = fileCache.get(cacheKey);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
      all.push(...cached.events);
      continue;
    }
    const events = await parseFile(file);
    fileCache.set(cacheKey, { mtimeMs: stat.mtimeMs, size: stat.size, events });
    all.push(...events);
  }
  return all;
}

async function computeUsage() {
  const now = Date.now();
  const events = await collectEvents();
  let tokens5h = 0;
  let tokens7d = 0;
  let last = 0;
  for (const { ts, tokens } of events) {
    if (now - ts <= SEVEN_DAYS_MS) tokens7d += tokens;
    if (now - ts <= FIVE_HOURS_MS) tokens5h += tokens;
    if (ts > last) last = ts;
  }
  return {
    provider: "anthropic",
    tokens5h,
    tokens7d,
    lastActivity: last || null,
    generatedAt: now,
  };
}

export function claudeUsagePlugin() {
  return {
    name: "claude-usage-endpoint",
    configureServer(server) {
      server.middlewares.use("/local/claude-usage", async (req, res) => {
        try {
          const data = await computeUsage();
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify(data));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: String(err?.message || err) }));
        }
      });
    },
  };
}
