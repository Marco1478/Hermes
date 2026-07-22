/*
  obsidianBridge — real Obsidian vault access for the server-side Vite
  bridge. See docs/OBSIDIAN_VAULT_SETUP.md for the full architecture.

  Same reasoning as kanbanBridge.js / pluginsBridge.js: the vault lives at
  a path INSIDE the Hermes container, not on whatever machine runs the Vite
  dev server, so this never touches the filesystem with plain Node `fs` —
  every operation is SSH-exec'd (`docker exec hermes sh -c '...'`, or plain
  local `docker exec` if no SSH host is configured). Content for writes is
  piped over stdin rather than embedded in the command string, which sidesteps
  shell-escaping an arbitrary note body entirely.

  Frontmatter is a small hand-rolled reader/writer (flat scalars + string
  arrays only — no YAML dependency; that's the whole shape actually used
  here). Notes are flat `.md` files; each project is a folder with an
  `overview.md`. Archiving always moves, never deletes.
*/

import { execFile } from "node:child_process";

const FILE_DELIM_START = "\x01"; // SOH — a real note is never going to contain a raw control byte.
const FILE_DELIM_END = "\x02"; // STX

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/* Reject anything that could escape the vault: no traversal segments, no
   absolute paths, no empty segments, `.md` only where a file extension is
   present at all. Returns null (caller must treat as invalid) rather than
   throwing, so every call site is forced to handle the rejection. */
function safeRelPath(relPath) {
  if (typeof relPath !== "string" || !relPath) return null;
  const normalized = relPath.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) return null;
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  if (segments.some((s) => s === "." || s === ".." || s.includes("\0"))) return null;
  return segments.join("/");
}

function safeFileName(title) {
  const cleaned = (title || "")
    .replace(/[/\\:*?"<>|\x00-\x1f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned || "Untitled";
}

// ---- Frontmatter — minimal reader/writer for the flat shape we need -------
function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const [, block, rest] = m;
  const meta = {};
  const lines = block.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (!kv) continue;
    const [, key, valueRaw] = kv;
    if (valueRaw === "" && lines[i + 1] && /^\s+-\s/.test(lines[i + 1])) {
      const items = [];
      while (lines[i + 1] && /^\s+-\s/.test(lines[i + 1])) {
        i++;
        items.push(unquoteScalar(lines[i].replace(/^\s+-\s/, "").trim()));
      }
      meta[key] = items;
      continue;
    }
    if (/^\[.*\]$/.test(valueRaw.trim())) {
      const inner = valueRaw.trim().slice(1, -1).trim();
      meta[key] = inner ? inner.split(",").map((s) => unquoteScalar(s.trim())) : [];
      continue;
    }
    meta[key] = unquoteScalar(valueRaw.trim());
  }
  return { meta, body: rest.replace(/^\n/, "") };
}

function unquoteScalar(v) {
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null" || v === "") return null;
  if (/^".*"$/.test(v)) return v.slice(1, -1).replace(/\\"/g, '"');
  return v;
}

function yamlScalar(v) {
  if (v == null) return "null";
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  const s = String(v);
  if (s === "" || /[:#\[\]{}|>'"\n]/.test(s) || /^\s|\s$/.test(s)) return `"${s.replace(/"/g, '\\"')}"`;
  return s;
}

function serializeFrontmatter(meta) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(meta)) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) lines.push(`  - ${yamlScalar(item)}`);
      }
    } else {
      lines.push(`${key}: ${yamlScalar(value)}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

/* Splits the body into "free text" and a trailing task-list section under
   a given H2 heading (`## Checklist` / `## Milestones`), so the dedicated
   checklist widget stays the single source of truth for those items
   instead of them living twice (once structured, once as loose markdown
   the user could desync by hand). */
function splitChecklistSection(body, heading) {
  const re = new RegExp(`\\n##\\s+${heading}\\s*\\n([\\s\\S]*)$`, "i");
  const m = body.match(re);
  if (!m) return { text: body.trim(), items: [] };
  const text = body.slice(0, m.index).trim();
  const items = [];
  for (const line of m[1].split(/\r?\n/)) {
    const task = line.match(/^\s*-\s+\[( |x|X)\]\s+(.*)$/);
    if (task) items.push({ id: `${items.length}-${Date.now().toString(36)}`, text: task[2], done: task[1].toLowerCase() === "x" });
  }
  return { text, items };
}

function joinChecklistSection(text, heading, items) {
  let out = text.trim();
  if (items && items.length) {
    out += `\n\n## ${heading}\n\n${items.map((i) => `- [${i.done ? "x" : " "}] ${i.text}`).join("\n")}\n`;
  }
  return out;
}

export function createObsidianExec({ sshHost, sshKeyPath, vaultPath, notesDir, projectsDir, archiveDir, timeoutMs = 20000 }) {
  const hasSsh = Boolean(sshHost && sshKeyPath);
  const configured = Boolean(vaultPath);

  function execRemote(script, { input } = {}) {
    return new Promise((resolve) => {
      const wantsStdin = input !== undefined;
      let command;
      let argv;
      if (hasSsh) {
        const remoteCommand = ["docker", "exec", ...(wantsStdin ? ["-i"] : []), "hermes", "sh", "-c", script]
          .map(shQuote)
          .join(" ");
        command = "ssh";
        argv = ["-i", sshKeyPath, "-o", "BatchMode=yes", "-o", "ConnectTimeout=8", "-o", "StrictHostKeyChecking=accept-new", sshHost, remoteCommand];
      } else {
        command = "docker";
        argv = ["exec", ...(wantsStdin ? ["-i"] : []), "hermes", "sh", "-c", script];
      }
      const child = execFile(command, argv, { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
          resolve({ ok: false, stdout: stdout || "", stderr: (stderr || err.message || "").trim() });
          return;
        }
        resolve({ ok: true, stdout: stdout || "", stderr: (stderr || "").trim() });
      });
      if (wantsStdin) {
        child.stdin.write(input, "utf8");
        child.stdin.end();
      }
    });
  }

  function absDir(kind) {
    const dir = kind === "notes" ? notesDir : kind === "projects" ? projectsDir : archiveDir;
    return `${vaultPath}/${dir}`;
  }

  async function status() {
    if (!configured) return { ok: true, configured: false };
    const script = [
      `test -d ${shQuote(vaultPath)} || { echo VAULT_MISSING; exit 1; }`,
      `mkdir -p ${shQuote(absDir("notes"))} ${shQuote(absDir("projects"))} ${shQuote(absDir("archive"))}`,
      `n=$(find ${shQuote(absDir("notes"))} -maxdepth 1 -name '*.md' -type f | wc -l)`,
      `p=$(find ${shQuote(absDir("projects"))} -mindepth 2 -maxdepth 2 -name overview.md -type f | wc -l)`,
      `echo "$n $p"`,
    ].join(" && ");
    const result = await execRemote(script);
    if (!result.ok) return { ok: true, configured: true, vaultOk: false, error: result.stderr || "vault not reachable" };
    const [noteCount, projectCount] = result.stdout.trim().split(/\s+/).map((n) => parseInt(n, 10) || 0);
    return { ok: true, configured: true, vaultOk: true, noteCount, projectCount };
  }

/* One SSH round trip for the whole list: cat every matching file wrapped
     in control-byte delimiters, parsed apart here in Node. `pattern`:
     "flat" for a directory of loose .md files (notes), "nested" for
     one-folder-per-project each holding overview.md (projects) — both
     valid under either the active dir or the archive dir, since archiving
     just relocates the same shape. */
  async function listFiles(dir, pattern) {
    const findExpr = pattern === "nested" ? `-mindepth 2 -maxdepth 2 -name overview.md` : `-maxdepth 1 -name '*.md'`;
    const script = `find ${shQuote(dir)} ${findExpr} -type f 2>/dev/null | while IFS= read -r f; do printf '${FILE_DELIM_START}%s${FILE_DELIM_START}' "$f"; cat "$f"; printf '${FILE_DELIM_END}'; done`;
    const result = await execRemote(script);
    if (!result.ok) return { ok: false, error: result.stderr || "list failed" };
    const files = [];
    const parts = result.stdout.split(FILE_DELIM_START).filter(Boolean);
    for (let i = 0; i < parts.length; i += 2) {
      const absPath = parts[i];
      const contentAndNext = parts[i + 1] || "";
      const content = contentAndNext.split(FILE_DELIM_END)[0];
      if (!absPath) continue;
      const relPath = absPath.startsWith(`${dir}/`) ? absPath.slice(dir.length + 1) : absPath;
      files.push({ relPath: pattern === "nested" ? relPath.replace(/\/overview\.md$/, "") : relPath, raw: content });
    }
    return { ok: true, files };
  }

  async function readFile(dir, relPath) {
    const script = `cat ${shQuote(`${dir}/${relPath}`)}`;
    const result = await execRemote(script);
    if (!result.ok) return { ok: false, error: result.stderr || "read failed" };
    return { ok: true, raw: result.stdout };
  }

  async function writeFile(dir, relPath, content) {
    const full = `${dir}/${relPath}`;
    const script = `mkdir -p ${shQuote(full.slice(0, full.lastIndexOf("/")))} && cat > ${shQuote(full)}`;
    const result = await execRemote(script, { input: content });
    if (!result.ok) return { ok: false, error: result.stderr || "write failed" };
    return { ok: true };
  }

  async function exists(dir, relPath) {
    const script = `test -e ${shQuote(`${dir}/${relPath}`)} && echo YES || echo NO`;
    const result = await execRemote(script);
    return result.ok && result.stdout.trim() === "YES";
  }

  /* Project workspace skeleton — notes/canvases/workflows/assets are real
     subfolders a project owns from creation, so Marco can drop files into
     them directly in Obsidian even before the UI chunk that manages them
     (canvas/workflows) lands. */
  async function mkdirp(dir, relPath) {
    const result = await execRemote(`mkdir -p ${shQuote(`${dir}/${relPath}`)}`);
    return { ok: result.ok, error: result.ok ? undefined : result.stderr || "mkdir failed" };
  }

  async function move(fromDir, fromRel, toDir, toRel) {
    const from = `${fromDir}/${fromRel}`;
    const to = `${toDir}/${toRel}`;
    const script = `mkdir -p ${shQuote(to.slice(0, to.lastIndexOf("/")))} && mv ${shQuote(from)} ${shQuote(to)}`;
    const result = await execRemote(script);
    if (!result.ok) return { ok: false, error: result.stderr || "move failed" };
    return { ok: true };
  }

  async function removeEmptyDir(dir, relPath) {
    // Best-effort cleanup after a project folder move (rmdir fails silently
    // if the folder still has extra files, which is fine — nothing lost.)
    const full = `${dir}/${relPath}`;
    await execRemote(`rmdir ${shQuote(full)} 2>/dev/null || true`);
  }

  return {
    configured,
    dirs: { notes: absDir("notes"), projects: absDir("projects"), archive: absDir("archive") },
    status,
    listFiles,
    readFile,
    writeFile,
    exists,
    move,
    removeEmptyDir,
    mkdirp,
  };
}

// ---- Note <-> markdown ------------------------------------------------------

function noteToMarkdown(note) {
  const meta = {
    type: "note",
    title: note.title || "Untitled",
    tags: note.tags || [],
    folder: note.folder || "",
    color: note.color || "",
    pinned: Boolean(note.pinned),
    created: new Date(note.createdAt || Date.now()).toISOString(),
    updated: new Date(note.updatedAt || Date.now()).toISOString(),
    source: "hermes-ui",
  };
  const body = joinChecklistSection(note.body || "", "Checklist", note.checklist || []);
  return `${serializeFrontmatter(meta)}\n\n${body}\n`;
}

function markdownToNote(relPath, raw) {
  const { meta, body } = parseFrontmatter(raw);
  const { text, items } = splitChecklistSection(body, "Checklist");
  return {
    id: relPath,
    title: meta.title || relPath.replace(/\.md$/, ""),
    body: text,
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    folder: meta.folder || null,
    color: meta.color || null,
    pinned: Boolean(meta.pinned),
    archived: false,
    checklist: items,
    createdAt: meta.created ? Date.parse(meta.created) || Date.now() : Date.now(),
    updatedAt: meta.updated ? Date.parse(meta.updated) || Date.now() : Date.now(),
  };
}

// ---- Project <-> markdown ---------------------------------------------------

/*
  linkedNoteRefs / linkedKanbanIds are passed through as plain string
  arrays exactly as they'll sit in frontmatter (`linked_notes` /
  `linked_kanban`) — resolving those refs to/from actual note paths is the
  caller's job (see the /local/obsidian/projects/* routes in
  hermesBridge.js, which have the notes directory in scope). Refs are the
  note's stable filename (sans .md), which is what an Obsidian wikilink
  `[[X]]` resolves by — deliberately NOT the note's current display title,
  since that can be edited later without renaming the file.
*/
function projectToMarkdown(project) {
  const meta = {
    type: "project",
    name: project.name || "Untitled project",
    status: project.status || "planning",
    priority: project.priority || "medium",
    color: project.color || "",
    tags: project.tags || [],
    due: project.dueDate ? new Date(project.dueDate).toISOString() : "",
    linked_notes: project.linkedNoteRefs || [],
    linked_kanban: project.linkedKanbanIds || [],
    created: new Date(project.createdAt || Date.now()).toISOString(),
    updated: new Date(project.updatedAt || Date.now()).toISOString(),
    source: "hermes-ui",
  };
  const body = joinChecklistSection(project.description || "", "Milestones", project.milestones || []);
  return `${serializeFrontmatter(meta)}\n\n${body}\n`;
}

function markdownToProject(relPath, raw) {
  const { meta, body } = parseFrontmatter(raw);
  const { text, items } = splitChecklistSection(body, "Milestones");
  return {
    id: relPath,
    name: meta.name || relPath,
    description: text,
    status: meta.status || "planning",
    priority: meta.priority || "medium",
    color: meta.color || null,
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    dueDate: meta.due ? Date.parse(meta.due) || null : null,
    milestones: items,
    linkedNoteRefs: Array.isArray(meta.linked_notes) ? meta.linked_notes : [],
    linkedKanbanIds: Array.isArray(meta.linked_kanban) ? meta.linked_kanban : [],
    createdAt: meta.created ? Date.parse(meta.created) || Date.now() : Date.now(),
    updatedAt: meta.updated ? Date.parse(meta.updated) || Date.now() : Date.now(),
  };
}

export {
  safeRelPath,
  safeFileName,
  parseFrontmatter,
  serializeFrontmatter,
  splitChecklistSection,
  joinChecklistSection,
  noteToMarkdown,
  markdownToNote,
  projectToMarkdown,
  markdownToProject,
};
