# Claude Instructions 004 — Obsidian-backed Notes, Projects, and Persistent Knowledge Loop

## Context

Marco noticed the correct structural problem: the new Notes and Projects tabs currently persist in browser `localStorage`. That is acceptable as an honest prototype, but it is not the durable memory layer he wants. The target is an Obsidian-compatible markdown vault that the custom UI can write to, Hermes can read/search, and Claude/Hermes can reference from Kanban/Projects.

Research summary:

- Obsidian is local-first. A vault is a normal folder of markdown files.
- Obsidian does not provide an official cloud REST API for third-party apps / Obsidian Sync.
- Community plugins exist, including `obsidian-local-rest-api`, which exposes an authenticated local REST API, but this should be optional, not the primary architecture.
- For this server/container setup, the most robust primary integration is filesystem-backed markdown via a mounted vault folder.
- No Obsidian account token is required for the filesystem approach.

## What Marco needs to provide / configure before full end-to-end verification

Marco should **not paste secrets in chat or commit them**.

Required for the filesystem-backed integration:

1. An Obsidian vault folder accessible to the Linux VM / Docker host.
   - Example host path: `/mnt/hermes/obsidian-vault` or another persistent folder.
   - If Marco's vault lives on Windows, sync/mirror it to the Linux VM first via Syncthing, Obsidian Sync local copy, SMB mount, or another stable file sync. Do not make the container depend on an unavailable Windows desktop path.
2. Mount that folder into the Hermes/custom UI container:
   - Host path → container path example:
     - `/mnt/hermes/obsidian-vault:/opt/data/obsidian-vault`
3. Add local env/config, never committed:
   - `OBSIDIAN_VAULT_PATH=/opt/data/obsidian-vault`
   - optional: `OBSIDIAN_NOTES_DIR=Hermes/Notes`
   - optional: `OBSIDIAN_PROJECTS_DIR=Hermes/Projects`
   - optional: `OBSIDIAN_ARCHIVE_DIR=Hermes/Archive`
4. The container must be able to read/write markdown files under that path.
5. Optional only: if Marco wants Obsidian desktop live API later, he can install `obsidian-local-rest-api` and provide its local API URL/auth value via env. Do **not** require this for the first implementation.

## Operating Rules

- Work chunks in numeric order unless a chunk is blocked and a later chunk is independent.
- Verify every chunk before moving on.
- Commit locally after each verified chunk.
- If blocked by missing vault path / volume / permissions, create a clear blocker status file and continue with UI/diagnostic work that can be done safely.
- Push to GitHub only once after completing the whole instruction file or documenting every blocker.
- Never commit `.env.local`, tokens, API keys, passwords, local vault content dumps, or private note content.
- Do not use `localStorage` as the source of truth once the Obsidian vault is configured. Local cache is acceptable only as cache/offline fallback with clear UI diagnostics.
- Filesystem access must be path-safe: no `../`, no absolute user-provided paths, markdown-only by default, archive instead of hard delete.
- If the vault is missing, show a `DiagnosticCard` explaining exactly what Marco must mount/configure.

---

## CLAUDE-001 — Audit current Notes/Projects persistence and define vault contract

**Objective:**

Confirm the current state and introduce a clear configuration contract for Obsidian-backed persistence.

**Files likely involved:**

- `src/state/Notes.jsx`
- `src/state/Projects.jsx`
- `src/components/notes/NotesPage.jsx`
- `src/components/projects/ProjectsPage.jsx`
- `vite-plugins/hermesBridge.js`
- new or existing setup docs under `docs/`

**Implementation notes:**

- Verify that Notes/Projects currently use localStorage.
- Add a short project doc explaining the Obsidian architecture and required volume/env.
- Define env names:
  - `OBSIDIAN_VAULT_PATH`
  - `OBSIDIAN_NOTES_DIR`
  - `OBSIDIAN_PROJECTS_DIR`
  - `OBSIDIAN_ARCHIVE_DIR`
- If env is absent, UI must say: `Obsidian vault not configured`, not pretend persistence exists.

**Verification gate:**

- Read current implementation and cite exact persistence mechanism in the final status report.
- `npm run build` passes.
- No private vault path or secret value is committed.

**Commit rule:**

Commit when verified with message:

```text
docs: define Obsidian vault persistence contract
```

---

## CLAUDE-002 — Add safe Obsidian filesystem bridge

**Objective:**

Implement real server-side bridge endpoints that operate on markdown files inside the configured Obsidian vault.

**Files likely involved:**

- `vite-plugins/obsidianBridge.js` or `vite-plugins/notesBridge.js`
- `vite-plugins/hermesBridge.js`
- `src/lib/obsidianBridge.js` or `src/lib/notesBridge.js`
- `package.json` only if scripts are needed; avoid unnecessary dependencies

**Bridge endpoints to implement:**

```text
GET  /local/obsidian/status
GET  /local/obsidian/notes/list
GET  /local/obsidian/notes/read?path=...
POST /local/obsidian/notes/write
POST /local/obsidian/notes/create
POST /local/obsidian/notes/archive
GET  /local/obsidian/notes/search?q=...
GET  /local/obsidian/projects/list
POST /local/obsidian/projects/write
```

Names may differ if a cleaner internal convention already exists, but keep the surface explicit and documented.

**Implementation notes:**

- Use Node filesystem APIs from the Vite bridge/plugin layer.
- Resolve configured root path once.
- Every requested note/project path must be normalized and verified to remain inside the vault root.
- Allow `.md` only for note body operations.
- Generate safe filenames from note/project titles.
- Archive means move to `OBSIDIAN_ARCHIVE_DIR`, not delete.
- Include frontmatter for structured metadata where useful:

```yaml
---
type: note
tags: []
folder: Hermes/Notes
created: 2026-07-22T00:00:00.000Z
updated: 2026-07-22T00:00:00.000Z
source: hermes-ui
---
```

- Preserve markdown body as human-readable Obsidian content.
- Do not create binary/image attachment handling in this chunk.

**Verification gate:**

- With no vault configured: `/local/obsidian/status` returns configured false and useful diagnostic.
- With a temporary test vault under `/tmp/hermes-obsidian-vault-test`: create/read/write/search/archive all work.
- Path traversal attempts are rejected:
  - `../secret.md`
  - `/etc/passwd`
  - encoded traversal equivalents if applicable.
- `npm run build` passes.

**Commit rule:**

Commit when verified with message:

```text
feat: add safe Obsidian markdown bridge
```

---

## CLAUDE-003 — Convert Notes from localStorage source-of-truth to Obsidian-backed data

**Objective:**

Make Notes tab persist to markdown files in the vault when configured.

**Files likely involved:**

- `src/state/Notes.jsx`
- `src/components/notes/NotesPage.jsx`
- `src/lib/obsidianBridge.js`
- `src/components/DiagnosticCard.jsx`
- `src/components/notes/NotesPage.css`

**Implementation notes:**

- On load, fetch notes from the Obsidian bridge if configured.
- Show status chip:
  - `Obsidian vault connected`
  - `local cache only`
  - `vault not configured`
- Create note writes a real `.md` file.
- Edit title/body/tags/folder/checklist updates frontmatter/markdown.
- Archive moves file to archive folder.
- Search uses bridge search or a client-side search over fetched notes if dataset is small.
- Keep localStorage only as:
  - migration source for existing local notes;
  - offline/session cache;
  - fallback with clear warning.
- Add one-click migration/export path for existing local notes:
  - `Migrate local notes to vault`
  - If no vault: disabled with diagnostic.

**Verification gate:**

- Create note in UI → corresponding markdown file exists in test vault.
- Edit note in UI → file content changes.
- Archive note in UI → file moves to archive folder.
- Refresh page → note reloads from file, not localStorage.
- Empty/missing vault shows diagnostic, no crash.
- Browser console has zero JS errors.
- `npm run build` passes.

**Commit rule:**

Commit when verified with message:

```text
feat: persist notes to Obsidian vault
```

---

## CLAUDE-004 — Convert Projects to Obsidian-backed project folders/files

**Objective:**

Make Projects durable and Obsidian-readable too.

**Files likely involved:**

- `src/state/Projects.jsx`
- `src/components/projects/ProjectsPage.jsx`
- `src/components/projects/ProjectsPage.css`
- `src/lib/obsidianBridge.js`

**Recommended vault structure:**

```text
Hermes/
  Notes/
    Business Outreach.md
  Projects/
    Hermes Custom UI/
      overview.md
      roadmap.md
      decisions.md
      links.md
    Portfolio Web/
      overview.md
      roadmap.md
      decisions.md
  Archive/
```

**Implementation notes:**

- Each project should map to a project folder or a single `overview.md` with metadata.
- If using folders, keep an `overview.md` as the main project file.
- Project fields should be represented as frontmatter:

```yaml
---
type: project
status: active
priority: high
linked_notes:
  - Hermes/Notes/Piano monetizzazione post-vacanze.md
linked_kanban:
  - t_xxxxxxxx
---
```

- Projects should link to notes via Obsidian wikilinks when possible:
  - `[[Piano monetizzazione post-vacanze]]`
- If a project links to a Kanban task, store task ID in metadata and show it in UI.

**Verification gate:**

- Create project → folder/file exists in test vault.
- Edit status/priority/body → markdown/frontmatter updates.
- Link a note → wikilink/metadata persists.
- Refresh page → project reloads from vault.
- `npm run build` passes.

**Commit rule:**

Commit when verified with message:

```text
feat: persist projects to Obsidian vault
```

---

## CLAUDE-005 — Connect Kanban tasks to Obsidian notes/projects

**Objective:**

Make Kanban the action layer and Obsidian the knowledge layer.

**Files likely involved:**

- `src/components/kanban/KanbanDetailDrawer.jsx`
- `src/components/kanban/KanbanTaskActions.jsx`
- `src/components/kanban/KanbanPage.jsx`
- `src/lib/kanbanBridge.js`
- `src/lib/obsidianBridge.js`

**Implementation notes:**

- In task detail drawer, add linked notes/projects section.
- Allow creating a note from a task:
  - title: task title
  - body includes task context and link back to task ID
- Allow linking an existing note/project to a Kanban task.
- Persist the relation in the markdown frontmatter and/or a task comment.
- Do not mutate Hermes Kanban internals directly unless an existing CLI/API supports it; if needed, add a task comment like:

```text
Linked Obsidian note: [[...]]
```

**Verification gate:**

- Create note from Kanban task → markdown file created with task ID.
- Link note to task → visible in drawer after refresh.
- No duplicate note creation on repeated clicks.
- `npm run build` passes.

**Commit rule:**

Commit when verified with message:

```text
feat: link Kanban tasks to Obsidian notes
```

---

## CLAUDE-006 — Make Hermes-readable knowledge loop explicit

**Objective:**

Ensure the UI and docs make clear how Hermes can read/reference the vault.

**Files likely involved:**

- `docs/OBSIDIAN_VAULT_SETUP.md`
- `src/components/system/SystemOverviewPage.jsx`
- `src/components/notes/NotesPage.jsx`
- `src/components/projects/ProjectsPage.jsx`
- `src/components/testing/BackendTestCenter.jsx`

**Implementation notes:**

- Add setup doc with Portainer volume example:

```text
HOST_PATH_TO_VAULT:/opt/data/obsidian-vault
```

- Add env example:

```text
OBSIDIAN_VAULT_PATH=/opt/data/obsidian-vault
OBSIDIAN_NOTES_DIR=Hermes/Notes
OBSIDIAN_PROJECTS_DIR=Hermes/Projects
OBSIDIAN_ARCHIVE_DIR=Hermes/Archive
```

- Add System Overview card/status for vault:
  - connected / not configured / permission error
  - note count
  - project count
  - last modified note
- Do not imply Obsidian Sync remote API exists.
- Mention optional `obsidian-local-rest-api` only as a future optional enhancement if Marco explicitly wants direct desktop Obsidian API behavior.

**Verification gate:**

- Documentation is enough for Marco to configure Portainer without exposing secrets.
- System Overview shows vault status without crashing when env absent.
- `npm run build` passes.

**Commit rule:**

Commit when verified with message:

```text
docs: add Obsidian vault setup guide
```

---

## CLAUDE-007 — Add permanent smoke checks for vault bridge

**Objective:**

Extend the existing smoke test so this feature stays verified.

**Files likely involved:**

- `scripts/smoke-backend.mjs`
- `package.json`
- `docs/claude/status/*.md`

**Implementation notes:**

- Smoke should use a temporary vault folder if `OBSIDIAN_VAULT_PATH` is not set.
- Checks:
  - bridge status works;
  - create/read/write/search/archive test note;
  - traversal rejected;
  - cleanup completed;
  - no secrets printed.
- If real vault configured, smoke can do reversible test under a `_Hermes Smoke Tests` folder, then archive/cleanup it.
- Do not leave test notes in Marco's real vault.

**Verification gate:**

- `npm run smoke` passes.
- Build passes.
- No test note remains in real vault unless explicitly placed in an Archive/Smoke folder and documented.

**Commit rule:**

Commit when verified with message:

```text
test: add Obsidian vault smoke checks
```

---

## CLAUDE-008 — Final visual QA, blocker handling, and one final push

**Objective:**

Consolidate, verify, and push once.

**Verification gate:**

- `npm run build` passes.
- `npm run smoke` passes.
- Browser QA:
  - Notes with no vault configured.
  - Notes with test vault configured if possible.
  - Projects with no vault configured.
  - Projects with test vault configured if possible.
  - Kanban task ↔ note link flow if implemented.
  - System Overview vault status card.
- Browser console has zero JS errors.
- Git diff contains no secrets and no private note content dumps.
- If vault volume/env is unavailable, blocker note says exactly what Marco must configure.

**Final report:**

Create a very short status artifact under:

```text
docs/claude/status/YYYY-MM-DD_obsidian_vault_implementation_report.md
```

Include:

- implemented chunks;
- build/smoke results;
- whether tested against temporary vault or real mounted vault;
- remaining blockers, if any.

**Push rule:**

Push to GitHub only once after the full instruction file is completed or all blockers are documented.
