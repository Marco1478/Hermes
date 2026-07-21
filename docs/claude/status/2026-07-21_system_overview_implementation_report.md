# Claude status report — Real System Overview and Backend Controls

Responding to `docs/claude/2026-07-21_1304_CLAUDE_INSTRUCTIONS_002.md`.

## Branch / commit

`main` @ `78dda80` (pending push at time of writing — see final push step).

Commit chain this pass (newest first):

```text
78dda80 fix: broaden and verify chat file attachments
76f0948 feat: add tool and mcp connection controls
aaf17d6 feat: add cron job creation flow
666e0d5 feat: add real memory management controls
a7e660a feat: restore usage rings and hero usage summary
0bf3564 feat: enrich system overview dashboard
1e0aff5 feat: add system overview tab navigation
```

## Completed chunks

- **CLAUDE-001** — new `system` view + `SystemOverviewPage` wired into
  `ViewMode`/`App.jsx`. BrandMark is now contextual (hero → System
  Overview; anywhere else → hero). Header `esc` pill removed everywhere
  (Escape key still works). Header tabs enlarged and centered via a
  3-column CSS grid (`minmax(0,1fr) auto minmax(0,1fr)` — a bare `1fr`
  would let the flanking columns overflow the viewport instead of
  shrinking, which is exactly the bug this caught and fixed).
- **CLAUDE-002** — System Overview is a real dashboard: gateway
  health/latency/version/base-url, machine stats, platforms, usage,
  jobs/tools/MCP/memory/profile summaries (each a clickable card that
  jumps to its full page), recent sessions. Missing/failed sections
  render a `DiagnosticCard` naming the exact endpoint, not a blank area.
  The old large control-center panel is gone from the hero.
- **CLAUDE-003** — Usage rings restored (`UsageRing.jsx`, shared between
  the hero's compact widget and System Overview's larger ones — same
  component, different `size`). Hero keeps only a small two-ring widget,
  top-right, that opens System Overview on click.
- **CLAUDE-004** — real backend controls:
  - **Memory**: edit/delete wired to `GET/PUT/DELETE /api/learning/node`
    (verified against `agent/learning_mutations.py`). No create endpoint
    exists on this build (confirmed by reading the module — only
    `node_detail`/`edit_node`/`delete_node`); "add a new memory" is not
    implemented rather than faked. Scoped to memory entries only — a
    skill node's drawer `body` is its short description, not its full
    SKILL.md, so editing it in place would have overwritten the real
    file with the description; skills stay read-only here and use the
    Hermes page's toggle instead.
  - **Default model switching**: already fully implemented from an
    earlier session (`ModelSelector.jsx` → real `POST /api/model/set`,
    global, all platforms) — no changes needed, re-verified working.
  - **Job creation**: real `POST /api/cron/jobs` (`CronJobCreate` model:
    prompt/schedule/name/deliver/…). New "+ new job" button + modal on
    the Jobs page. `DELETE /api/cron/jobs/{id}` also wired (was findable
    in the route table but unused before) so test/unwanted jobs can be
    removed, not just paused forever.
  - **Toolset / MCP enable-disable**: real `PUT /api/tools/toolsets/{name}`
    and `PUT /api/mcp/servers/{name}/enabled` (verified models:
    `ToolsetToggle`, `MCPEnabledToggle`). Toggle switches added to both
    card grids on the Tools page.
  - **File attachments**: images are now sent for real — read as a
    base64 data URL, sent as an `image_url` content part on the Runs
    API's `input` array (same content-part vocabulary the gateway's
    OpenAI-compatible endpoint accepts). PDFs/docs are a confirmed real
    backend gap (`_FILE_PART_TYPES` → `unsupported_content_type` in
    `gateway/platforms/api_server.py`) — documented as a blocker rather
    than faked; see
    `docs/claude/status/2026-07-21_file-attach-pdf-blocker.md`.
- **CLAUDE-005** — this report, plus the final QA pass below.

## What works (verified live, not assumed)

- `npm run build` passes after every commit.
- Fresh-tab browser console: zero errors across Hero, Chat, Hermes,
  Jobs, Tools, System — desktop (800px, 1280px) and mobile (375px).
- **Memory edit**: opened a real entry ("Marco's favourite colour is
  teal."), appended text, saved, confirmed the card updated with the
  real edit, then edited back to the exact original text and saved
  again — round-tripped clean.
- **Job creation**: created a real job ("UI test job (delete me)",
  schedule far in the future, `deliver: local` so nothing reached
  Telegram), confirmed it appeared with real state (`SCHEDULED`, correct
  next-run), then deleted it via the new delete button — gone from a
  fresh reload.
- **Toolset toggle**: toggled `image_gen` off, confirmed via the PUT
  response (`{"ok":true,"name":"image_gen","enabled":false}`) and via
  `docker exec hermes cat config.yaml` that the write was real, then
  toggled it back on and re-verified the config lists it under
  `platform_toolsets.cli` again. Note: the *running* gateway caches its
  toolset list at startup, so `GET /v1/toolsets` doesn't reflect a
  toggle until the gateway restarts — this is real backend behaviour
  (same pattern as the MCP enable endpoint's own docstring), not a bug;
  a note to that effect is now on the Tools page.
- **Image attachment**: attached a real PNG (the BrandMark portrait) and
  asked Hermes to describe it — its reply ("A minimalist white line-art
  profile of a girl with long flowing hair wearing over-ear headphones
  on a black background.") accurately describes the actual image,
  confirming the multimodal path works end-to-end, not just that the
  request didn't error.
- Navigation: BrandMark's contextual behavior, all 5 non-hero tabs,
  System Overview's summary-card links (Jobs/Tools/Hermes/Memory) all
  click-tested.

## Blockers / needs Marco or Hermes input

- **PDF/document attachments**: no real backend path exists (see the
  dedicated blocker doc). Needs either a text-extraction endpoint or the
  gateway accepting `file`/`input_file` content parts.
- **MCP server enable/disable**: the control is real and wired, but
  `mcp_servers` is empty on this profile (`{"servers":[]}`) — nothing to
  toggle live until Marco configures one via the CLI. Not a bug, just
  untested against a live server for lack of one.
- **Adding new memory entries**: no real backend endpoint (see CLAUDE-004
  notes above) — edit/delete are real, create is not implemented on this
  build.

## Commands run for verification

```bash
npm run build
git status --short --branch
```

Plus interactive browser verification (Claude Code's Browser pane) and
one read-only SSH check (`docker exec hermes cat config.yaml`) to
confirm the toolset toggle's write actually landed, not just that the
HTTP call returned 200.
