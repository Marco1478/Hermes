# Obsidian vault implementation — status report

Ran against instruction file `docs/claude/2026-07-22_1117_CLAUDE_INSTRUCTIONS_004.md`.

## Shipped

All 8 chunks (CLAUDE-001 through CLAUDE-008), each committed separately:

- **001** — persistence contract + `docs/OBSIDIAN_VAULT_SETUP.md`.
- **002** — `vite-plugins/obsidianBridge.js`: SSH-exec'd filesystem bridge
  (same architecture as Kanban/Plugins), hand-rolled frontmatter
  reader/writer, path-traversal-safe.
- **003** — Notes converted from localStorage-source-of-truth to
  vault-backed, with localStorage demoted to cache/fallback, a shared
  `VaultStatusChip`, per-note debounced writes, and a "migrate to vault"
  action for pre-existing local notes.
- **004** — same treatment for Projects; `archived` became a location
  (moved folder) instead of a status enum value.
- **005** — Kanban task detail can create a note from a task or link an
  existing one; persisted as a real Kanban comment (no fake
  `linked_notes` field invented on the task itself).
- **006** — System Overview "Obsidian Vault" card (connected/not-configured/
  error, live note/project counts, last-edited time).
- **007** — `npm run smoke` extended with 8 real Obsidian checks, reusing
  the actual bridge module (not a reimplementation).
- **008** — this report; final push.

## Verified

- `npm run build` passes throughout.
- `npm run smoke`: all 8 new `obsidian` checks pass against the real
  configured vault (`/opt/data/obsidian-vault` on the box) — status,
  path-traversal rejection, create/read/list/archive, cleanup.
- Tested against the **real mounted vault** end-to-end for every write
  path (not a temporary vault): note create/edit/archive, project
  create/edit/link-note/archive, Kanban→note create+link, System Overview
  card — each confirmed both in the UI and via direct SSH inspection of
  the actual files on disk. All test artifacts cleaned up after; vault
  confirmed empty at the end of every session.
- Also verified the **no-vault fallback path** (temporarily unset
  `OBSIDIAN_VAULT_PATH`, restarted, retested): both tabs show "vault not
  configured — using local cache", local-only create/edit works, no
  crash, hard-delete button correctly reappears (it's hidden once vault-
  connected, since archiving covers that case there).
- Zero browser console errors across every surface touched.
- Diff scanned for secrets/private content — none found; `.env.local`
  correctly untracked throughout.

## Design decisions worth flagging

- **Filename stability**: a note/project's vault path is assigned once at
  creation from the initial title and never renamed on later title edits
  — frontmatter `title`/`name` is the editable display value. This is why
  a project's link into a note (or a task's link into a note) can't go
  stale just because the note was retitled later. Confirmed by test: an
  archived note whose file is still `Untitled.md` displayed and linked
  correctly as "Vault QA Note" throughout.
- **Kanban linking is a comment, not a field** — there's no
  `linked_notes` on a real Kanban task (verified against the CLI's actual
  args), so the relation is a real, durable `commentKanbanTask` call
  instead of invented local-only state.

## Known limitations (not blockers)

- Kanban "create note from task" guards against duplicate creation only
  for the current drawer-open session — closing and reopening the same
  task's drawer and clicking it again creates a second note (landing as
  `Title (2).md` via the create-time filename dedup, so nothing is
  overwritten, just an extra file).
- No `obsidian-local-rest-api` integration — deliberately out of scope
  per the instruction file (filesystem-backed is the primary
  architecture; the REST API plugin is a possible future enhancement
  only if Marco wants live desktop-Obsidian-app behavior specifically).

## Blockers

None for this instruction file's scope — the vault at
`/opt/data/obsidian-vault` was already mounted, writable, and matched the
expected `Hermes/{Notes,Projects,Archive}` structure exactly, so every
chunk was tested against the real thing rather than a temporary
stand-in.

One **unrelated, pre-existing** issue surfaced during smoke testing: the
Hermes dashboard service (port 9119) isn't currently running on the box
(`ps aux` inside the container shows only the `s6-supervise dashboard`
wrapper, no actual process; connections refused). This predates this
session, isn't touched by anything in this instruction file, and affects
4 pre-existing smoke checks (dashboard auth/model/cron/memory) that have
nothing to do with Obsidian. Flagging for awareness, not fixing here.

## Final commit/push

Pushed once, after this report, per the instruction file's push rule.
