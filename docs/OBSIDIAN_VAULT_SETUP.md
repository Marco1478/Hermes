# Obsidian vault persistence — architecture and setup

## Why

Notes and Projects (the custom UI's `notes`/`projects` tabs) originally
persisted to browser `localStorage` only — an honest prototype, but not
durable, not shared with Hermes, and invisible outside the browser tab that
created it. This document describes the real persistence layer: a plain
Obsidian-compatible markdown vault, mounted into the Hermes container,
that both this UI and Hermes itself (and Marco, in the actual Obsidian app)
can read and write.

## Architecture

Obsidian has no official cloud/remote REST API for third-party apps —
a vault is just a folder of markdown files. The one community plugin that
exposes a REST API (`obsidian-local-rest-api`) requires the Obsidian
desktop app to be running and is explicitly **not** used here; it's a
possible *future* optional enhancement, not the primary integration.

The primary integration is filesystem-backed markdown, same shape as the
Kanban and Plugins bridges (`vite-plugins/kanbanBridge.js`,
`vite-plugins/pluginsBridge.js`): the vault lives at a path *inside the
Hermes container*, not on whatever machine runs the Vite dev server, so
`vite-plugins/obsidianBridge.js` never touches the filesystem with plain
Node `fs` calls — every read/write/list/archive operation is SSH-exec'd
(`docker exec hermes sh -c '...'`, or plain SSH if no local Docker), with
file content passed over stdin for writes (avoids shell-escaping arbitrary
note bodies entirely) and every path checked against traversal before it's
ever joined into a remote command.

## Vault layout

```
<OBSIDIAN_VAULT_PATH>/
  Hermes/
    Notes/
      Some Note Title.md
    Projects/
      Some Project Name/
        overview.md
        notes/          (scaffolded, currently unused — project notes are
                          free notes linked by reference, see below)
        canvases/
          Architecture map.canvas.json
        workflows/
          Feature workflow.workflow.json
        assets/          (scaffolded, no UI writes here yet)
    Archive/
      Some Note Title.md
      Some Project Name/
        overview.md
        canvases/
          Architecture map.canvas.json
        workflows/
          Feature workflow.workflow.json
```

Notes are flat `.md` files directly under `OBSIDIAN_NOTES_DIR` — including
notes "in" a project, which are never copied or moved into the project
folder; a project only ever holds a *reference* (`linked_notes` in its own
frontmatter) to a note's stable filename. The `notes/`/`assets/` subfolders
under a project are scaffolded at creation time (see `mkdirp` in
`vite-plugins/obsidianBridge.js`) so Marco can drop files in directly from
Obsidian even though the UI doesn't manage that subfolder itself yet.

Canvases and workflows *do* live inside their owning project's folder,
as flat `.json` files (not markdown, and not Obsidian desktop's own
`.canvas` format) — `<project>/canvases/<Name>.canvas.json` and
`<project>/workflows/<Name>.workflow.json`. Each project can freely gain
more files in its folder (`roadmap.md`, `decisions.md`, ...) directly in
Obsidian; the UI only ever manages `overview.md`, `canvases/*.json`, and
`workflows/*.json`. Archiving moves the file (notes) or the whole folder
(projects, canvases, workflows) into `OBSIDIAN_ARCHIVE_DIR` — never a hard
delete. Archiving a project moves its whole folder in one operation, which
also relocates any canvases/workflows still inside it.

### File format

Every file is real frontmatter + real markdown body, readable and editable
in Obsidian with no plugin required:

```markdown
---
type: note
tags: [work, urgent]
folder: Ideas
color: teal
pinned: false
archived: false
created: 2026-07-22T09:00:00.000Z
updated: 2026-07-22T09:14:00.000Z
source: hermes-ui
---

Free-form markdown body here.

## Checklist

- [ ] first item
- [x] second item, done
```

Projects use `type: project` plus `status`, `priority`, `due`,
`linked_notes` (Obsidian wikilinks), `linked_kanban` (task IDs) in
frontmatter, and a `## Milestones` task-list section instead of
`## Checklist`. The checklist/milestone section is real Obsidian task-list
syntax — ticking a box in Obsidian itself is a valid edit the UI can read
back. `linked_kanban` is how a project and a real Kanban task relate: the
task itself has no `project_id` setter in the actual CLI, so the relation
is stored only here, on the project side — never invented on the task.

Frontmatter is parsed/serialized by a small hand-rolled reader in
`vite-plugins/obsidianBridge.js` (flat scalars + string arrays only — no
YAML dependency added; this codebase avoids new dependencies where a
~50-line parser covers the real shape needed).

Canvas and workflow files are plain JSON, not frontmatter+markdown (there's
no meaningful "body" to keep human-editable prose in, unlike a note):

```json
{
  "version": 1,
  "type": "hermes-project-canvas",
  "name": "Architecture map",
  "tags": ["smoke"],
  "nodes": [
    { "id": "...", "type": "card", "x": 60, "y": 60, "w": 220, "h": 130,
      "title": "Entry point", "body": "", "color": "teal", "tags": [],
      "checklist": [], "ref": null }
  ],
  "edges": []
}
```

`edges` is reserved shape only — this build has no UI to draw a connection
between nodes, so it's always `[]`; nothing reads it yet. A workflow file
looks the same but with `"type": "hermes-project-workflow"`, `"status"`
(`draft`/`active`/`done`), and a `"steps"` array instead of `"nodes"`/
`"edges"` (`{id, title, description, owner, status, linkedNoteId,
linkedCanvasId, linkedTaskId, command}` per step).

## Required configuration (never committed)

1. An Obsidian vault folder on the Docker host (or wherever Hermes's
   container runs), e.g. `/mnt/hermes/obsidian-vault`. If the vault
   normally lives on a different machine (Marco's Windows desktop),
   sync/mirror it to that host first (Syncthing, a local copy of Obsidian
   Sync, SMB, ...) — the container must not depend on a machine that isn't
   always reachable.
2. Mount it into the `hermes` container, e.g. (Portainer / docker-compose
   volume syntax):
   ```
   /mnt/hermes/obsidian-vault:/opt/data/obsidian-vault
   ```
3. Set in `.env.local` (git-ignored, never commit real values):
   ```
   OBSIDIAN_VAULT_PATH=/opt/data/obsidian-vault
   OBSIDIAN_NOTES_DIR=Hermes/Notes
   OBSIDIAN_PROJECTS_DIR=Hermes/Projects
   OBSIDIAN_ARCHIVE_DIR=Hermes/Archive
   ```
   `OBSIDIAN_VAULT_PATH` is the path **inside the container**, matching the
   volume mount's right-hand side above — not a path on whatever machine
   runs `npm run dev`.
4. The container must be able to read/write under that path (it runs
   `docker exec hermes ...` as the container's own user).

If `OBSIDIAN_VAULT_PATH` is unset, every Notes/Projects surface shows an
explicit "Obsidian vault not configured" diagnostic — it does not silently
fall back to pretending localStorage is the real store.

## What the UI does today

- Notes/Projects load from and save to the vault when configured.
- `localStorage` is now cache/offline-fallback only, with a status chip
  showing which mode is active (`vault connected` / `local cache only` /
  `vault not configured`), never silently presented as durable storage.
- A one-click "migrate local notes to vault" action moves anything that
  was created before the vault was configured.
- Kanban task detail can create a note from a task, or link an existing
  one — persisted as a real Kanban comment ("Linked Obsidian note:
  [[...]]"), since there's no `linked_notes` field on a real task.
- System Overview has an "Obsidian Vault" card: connected / not configured
  / error, plus live note/project counts and last-edited time when
  connected.
- Opening a project switches to a full workspace (`ProjectWorkspace.jsx`)
  with its own Overview / Notes / Canvas / Workflows / Kanban / Chat /
  Intelligence tabs:
  - **Canvas** — a pan/zoom board of typed nodes (text, sticky, card,
    decision, circle, checklist, image/file/note/kanban refs), persisted
    as the JSON format above.
  - **Workflows** — an ordered, drag-reorderable list of steps, persisted
    the same way.
  - **Kanban** — shows only the real tasks this project has linked
    (`linked_kanban`); creating/linking a task here also makes it appear
    on the *main* Kanban board with a project color chip, via a
    `projectByTaskId` lookup built from every project's `linked_kanban`.
  - **Intelligence** — a deterministic summary (active notes/workflows/
    open+blocked task counts, last-updated note, a rule-based "suggested
    next action") — not an LLM feature, since no Hermes
    analysis/summarize endpoint exists on this build yet.
  - **New project templates** (`src/lib/projectTemplates.js`) pre-fill
    the New Project form and, once the project exists, can scaffold a
    starter workflow (and for "Hermes feature", a starter canvas) via
    the same real write calls the Workflows/Canvas tabs use.

## Smoke coverage

`npm run smoke` (`scripts/smoke-backend.mjs`) exercises the real vault and
Kanban CLI directly through the same bridge modules the dev server uses
(not reimplemented) — status, path-traversal rejection, and reversible
create/read/list/update/archive/cleanup for notes, projects, canvases,
workflows, note↔project linking, and the project↔Kanban relation. Every
artifact it creates is named with a `_HERMES_UI_SMOKE_*_DELETE_ME` prefix
and removed again at the end of the run (`rm -rf` on the smoke script's own
throwaway paths only — the app itself never exposes a hard-delete). If a
run is interrupted mid-way, anything left behind is easy to spot and safe
to delete by that same prefix.

## Deliberately not done here

- No Obsidian Sync / cloud remote API — doesn't exist for third parties.
- No `obsidian-local-rest-api` integration — optional future enhancement,
  only worth adding if Marco wants live desktop-Obsidian-app behavior
  specifically (e.g. reacting to edits made while Obsidian is open).
- No binary/attachment handling — markdown-only.
