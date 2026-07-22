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
    Archive/
      Some Note Title.md
      Some Project Name/
        overview.md
```

Notes are flat `.md` files directly under `OBSIDIAN_NOTES_DIR`. Each
project is a folder under `OBSIDIAN_PROJECTS_DIR` containing an
`overview.md` — Marco (or Hermes) can freely add more files to a project
folder (`roadmap.md`, `decisions.md`, ...) directly in Obsidian; the UI
only ever manages `overview.md`. Archiving moves the file (notes) or the
whole folder (projects) into `OBSIDIAN_ARCHIVE_DIR`, preserving structure —
never a hard delete.

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
back.

Frontmatter is parsed/serialized by a small hand-rolled reader in
`vite-plugins/obsidianBridge.js` (flat scalars + string arrays only — no
YAML dependency added; this codebase avoids new dependencies where a
~50-line parser covers the real shape needed).

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

## Deliberately not done here

- No Obsidian Sync / cloud remote API — doesn't exist for third parties.
- No `obsidian-local-rest-api` integration — optional future enhancement,
  only worth adding if Marco wants live desktop-Obsidian-app behavior
  specifically (e.g. reacting to edits made while Obsidian is open).
- No binary/attachment handling — markdown-only.
