# Claude status report — Option 3 control-center upgrade (CLAUDE-001 → 012)

Responding to `docs/claude/2026-07-21_1655_CLAUDE_INSTRUCTIONS_003.md`.

## Shipped

- **CLAUDE-001** — investigated the reported System Overview scroll bug;
  didn't reproduce. `.page-scroll` already scrolls correctly; the
  suggested `document.scrollHeight` check can never pass by design (the
  hero needs `#root`/`.view` to be `position: fixed`). No code change —
  see `docs/claude/status/2026-07-21_claude-001-scroll-verification.md`.
- **CLAUDE-002** — real Kanban bridge. No HTTP endpoint exists for Kanban
  on this build; SSH-execs the real `hermes kanban` CLI inside the
  container instead (`vite-plugins/kanbanBridge.js`), every argument
  shell-quoted before joining into the command ssh forwards.
- **CLAUDE-003/004** — Kanban mission board tab: 6 real columns, detail
  drawer, and every write action (create/assign/comment/block/unblock/
  complete/archive/link/unlink) wired to the bridge.
- **CLAUDE-005** — global Ctrl/Cmd+K command palette, hand-built registry
  of every Telegram/CLI slash command (no dynamic source exists), each
  tagged with an honest execution status; confirmation gate for anything
  not `safe`.
- **CLAUDE-006** — Agent Activity Center: real merged timeline (cron,
  kanban, git log, docs/claude status files, chat sessions), compact +
  full filterable views.
- **CLAUDE-007** — Safety Center wraps the real DM-pairing approval
  endpoints (`/api/pairing*`) — the only genuine pending-approval queue
  this build exposes; named honestly that there's no generic per-tool-
  call approval queue. Added `ConfirmModal`, a shared confirm dialog, and
  retrofitted Jobs' delete to use it.
- **CLAUDE-008** — Mission Pipeline parses the real instruction/status
  files off disk into chunks + report links; a chunk only shows
  "reported" if some status doc's text literally mentions its id.
- **CLAUDE-009** — `scripts/smoke-backend.mjs` (`npm run smoke`), a
  dependency-free permanent smoke test, plus a Backend Test Center UI
  that runs the identical script via a bridge endpoint.
- **CLAUDE-010** — File Vault: explicit per-filetype support states with
  precise reasons, oversized-file rejections surfaced instead of
  silently dropped, local text-file preview before send.
- **CLAUDE-011** — Memory Studio summary strip: real entry/skill counts,
  two honestly-disabled actions (create, convert-to-skill) with exact
  reasons — no invented capacity percentage.
- **CLAUDE-012** — this report + final QA below.

## Verified (not assumed)

- `npm run build` passes after every commit in this chain.
- `npm run smoke` — 17/17 real backend checks pass against the live box
  (gateway health, dashboard auth, model/cron/memory/toolset read+write
  round-trips, kanban CLI, command registry, scroll-CSS regression).
- Browser QA: hero, chat, jobs, tools, hermes, kanban, missions, safety,
  system all loaded with zero console errors, including a 375px mobile
  pass on System Overview (scroll container still correct: real
  overflow, no horizontal scroll).
- Kanban write-action lifecycle (create → assign → comment → block →
  unblock → complete → archive) exercised through the actual UI, not
  just curl.
- Command palette: a real safe read (`/platforms`) executed and printed
  live data; a dangerous action (`/restart`) required confirmation and
  was cancelled rather than actually restarting the live gateway.
- Security scan: `git diff origin/main..HEAD` has no `.env.local`, no
  real secret values (grepped for the actual API key/password strings
  plus generic `password=`/`token=`/private-key patterns — zero hits).
  `.env.local` has never been committed in this repo's history.

## Known limitation, disclosed rather than faked

- Scroll regression check in the smoke script is a static CSS pattern
  match, not a real browser render+scroll test — no Playwright/browser-
  automation dependency in this project. Noted in the script's own
  output as the natural next step.
- Safety Center only covers DM pairing approvals — there is no generic
  "approve this dangerous tool call" queue on this build to wire up.
- Several command-palette entries are marked `unsupported`/
  `requires_backend` on purpose (see `src/data/commandRegistry.js`) —
  they're real Telegram/CLI-session-scoped behaviors with no web UI
  equivalent yet, not missing effort.

## Important: concurrent session on the shared Kanban board

While working CLAUDE-009, three new real Kanban tasks appeared that this
session did not create — about auditing/fixing System Overview's scroll
bug, the exact topic CLAUDE-001 already closed as a non-issue:

- `t_90e1fc62` — Audit System Overview layout and reproduce scroll bug
- `t_d232bb94` — Fix System Overview scroll and container foundations
- `t_b73e7f43` — Verify layout regression coverage for System Overview

The Kanban board is shared state on the box (SQLite, not per-UI-instance),
and port 5199 was occupied by another chat's dev server for this whole
session (confirmed at the very start — this session ran its own instance
on port 5237 instead). That strongly suggests **another Claude Code
session is independently working through this same instruction file
right now**, on the same repo. Left those tasks untouched (not this
session's to archive). Marco should check what that other session
concluded about CLAUDE-001 before treating it as reopened — it may
duplicate work already verified closed here.

## Commands run for verification

```bash
npm run build
npm run smoke
git status --short --branch
git diff origin/main..HEAD --stat
git fetch origin  # confirmed no remote-side commits to reconcile before push
```

Plus interactive browser verification (Claude Code's Browser pane, own
`vite --port 5237` instance since 5199 was occupied) and SSH checks
against the real box (`hermes kanban ...`, `hermes --help`,
`grep ... web_server.py`) to verify real endpoints before building
against them, per this session's approach throughout.

## Final push

Single push after this report, per instructions — no intermediate
pushes.
