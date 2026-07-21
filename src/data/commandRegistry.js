/*
  commandRegistry — metadata for every command Marco can already type as a
  Telegram/CLI slash command, surfaced here as a searchable palette.

  No dynamic source exists for this list: the gateway's slash-command
  dispatch lives inside its platform adapters (Telegram bot handler etc.),
  not behind any HTTP/CLI endpoint this UI can introspect (checked
  web_server.py and `hermes --help` — real subcommands exist for the
  underlying capability, e.g. `hermes sessions`, `hermes model`, `hermes
  cron`, but there's no "list slash commands" endpoint). So this is a
  hand-built registry per CLAUDE-005's fallback instruction, not a fake
  dynamic one — TODO: replace with a live source if/when the gateway
  exposes its command table.

  `status` is honest, not aspirational:
    - "available"       — this UI already has a real, working path for it
                           (execute() below calls the real bridge/nav).
    - "requires_backend" — real capability may exist deeper in Hermes, but
                           no endpoint is exposed to this web UI yet.
    - "unsupported"      — scoped to a running Telegram/CLI session this web
                           UI has no equivalent of (e.g. mid-conversation
                           /undo of THAT session).
*/
export const COMMAND_CATEGORIES = ["session", "configuration", "tools", "gateway", "utility", "exit"];

export const COMMANDS = [
  // ---- Session control ---------------------------------------------------
  { name: "new", category: "session", description: "Start a new conversation, discarding the current one.", surface: ["telegram", "cli"], risk: "state-changing", status: "unsupported", note: "Scoped to the Telegram/CLI session it's typed in — this UI already has its own New Chat action in the session drawer." },
  { name: "reset", category: "session", description: "Reset the current session's context.", surface: ["telegram", "cli"], risk: "state-changing", status: "unsupported", note: "Session-adapter command, no web UI equivalent endpoint." },
  { name: "retry", category: "session", description: "Re-run the last turn.", surface: ["telegram", "cli"], risk: "state-changing", status: "unsupported", note: "Session-adapter command, no web UI equivalent endpoint." },
  { name: "undo", category: "session", description: "Undo the last message pair.", surface: ["telegram", "cli"], risk: "state-changing", status: "unsupported", note: "Session-adapter command, no web UI equivalent endpoint." },
  { name: "title", category: "session", description: "Rename the current session.", paramHint: "<new title>", surface: ["telegram", "cli"], risk: "safe", status: "requires_backend", note: "`hermes sessions rename` exists on the CLI; not exposed via the dashboard bridge yet." },
  { name: "compress", category: "session", description: "Summarize and compress the running context to free tokens.", surface: ["telegram", "cli"], risk: "state-changing", status: "unsupported", note: "Session-adapter command, no web UI equivalent endpoint." },
  { name: "stop", category: "session", description: "Stop the in-flight run.", surface: ["telegram", "cli", "ui"], risk: "state-changing", status: "requires_backend", note: "This UI can already stop a run client-side mid-stream from the chat view; no dedicated bridge endpoint for a palette-level stop yet." },
  { name: "background", category: "session", description: "Move the current run to the background.", surface: ["telegram", "cli"], risk: "safe", status: "unsupported", note: "Session-adapter command, no web UI equivalent endpoint." },
  { name: "queue", category: "session", description: "Queue a message for after the current run finishes.", surface: ["telegram", "cli"], risk: "safe", status: "unsupported", note: "Session-adapter command, no web UI equivalent endpoint." },
  { name: "steer", category: "session", description: "Inject guidance into the running agent mid-turn.", surface: ["telegram", "cli"], risk: "state-changing", status: "unsupported", note: "Session-adapter command, no web UI equivalent endpoint." },
  { name: "agents", category: "session", description: "List/manage sub-agents in the current run.", surface: ["telegram", "cli"], risk: "safe", status: "unsupported", note: "Session-adapter command, no web UI equivalent endpoint." },
  { name: "resume", category: "session", description: "Resume a previous session.", paramHint: "<session id|name>", surface: ["telegram", "cli"], risk: "safe", status: "requires_backend", note: "`hermes sessions browse`/`--resume` exist on the CLI; this UI's own session drawer is the closest web equivalent." },
  { name: "goal", category: "session", description: "Run in a goal loop until a judge agrees the task is done.", surface: ["cli"], risk: "state-changing", status: "unsupported", note: "CLI-only run mode." },

  // ---- Configuration ------------------------------------------------------
  { name: "model", category: "configuration", description: "Show or change the active model/provider.", paramHint: "[provider/model]", surface: ["telegram", "cli", "ui"], risk: "state-changing", status: "available", note: "Real: GET /api/model/options + POST /api/model/set, same as the Hermes page's model selector. Reading is safe; setting is global (affects every platform) so it confirms first." },
  { name: "personality", category: "configuration", description: "Adjust the active profile's personality/soul.", surface: ["telegram", "cli"], risk: "state-changing", status: "requires_backend", note: "The Hermes page's soul.md editor is the real equivalent surface; not wired into the palette itself." },
  { name: "reasoning", category: "configuration", description: "Set reasoning effort for supporting models.", paramHint: "<low|medium|high>", surface: ["telegram", "cli"], risk: "safe", status: "unsupported", note: "No exposed config endpoint for this on the current build." },
  { name: "verbose", category: "configuration", description: "Toggle verbose tool-call output.", surface: ["telegram", "cli"], risk: "safe", status: "unsupported", note: "Session-adapter display setting, no web UI equivalent." },
  { name: "voice", category: "configuration", description: "Toggle voice reply mode.", surface: ["telegram"], risk: "safe", status: "unsupported", note: "Telegram-only feature." },
  { name: "yolo", category: "configuration", description: "Bypass dangerous-command approval prompts.", surface: ["cli"], risk: "dangerous", status: "unsupported", note: "CLI flag (--yolo), not something this UI should expose as a one-click toggle." },
  { name: "footer", category: "configuration", description: "Toggle the status footer.", surface: ["telegram", "cli"], risk: "safe", status: "unsupported", note: "Display setting local to the Telegram/CLI client." },
  { name: "statusbar", category: "configuration", description: "Toggle the live status bar.", surface: ["telegram", "cli"], risk: "safe", status: "unsupported", note: "Display setting local to the Telegram/CLI client." },

  // ---- Tools and skills -----------------------------------------------------
  { name: "tools", category: "tools", description: "List and toggle enabled toolsets.", surface: ["telegram", "cli", "ui"], risk: "state-changing", status: "available", note: "Real: GET /v1/toolsets, PUT /api/tools/toolsets/{name} — same as the Tools page." },
  { name: "toolsets", category: "tools", description: "Alias for /tools.", surface: ["telegram", "cli", "ui"], risk: "state-changing", status: "available", note: "Same real endpoint as /tools." },
  { name: "skills", category: "tools", description: "List and toggle installed skills.", surface: ["telegram", "cli", "ui"], risk: "state-changing", status: "available", note: "Real: GET /api/skills, PUT /api/skills/toggle — same as the Hermes page." },
  { name: "skill", category: "tools", description: "Show a single skill's detail.", paramHint: "<name>", surface: ["telegram", "cli"], risk: "safe", status: "requires_backend", note: "Read path exists (GET /api/skills); no per-name detail route wired into the palette yet." },
  { name: "reload-skills", category: "tools", description: "Reload the skills index from disk.", surface: ["telegram", "cli"], risk: "state-changing", status: "unsupported", note: "No exposed reload endpoint on this build." },
  { name: "reload", category: "tools", description: "Reload configuration.", surface: ["telegram", "cli"], risk: "state-changing", status: "unsupported", note: "No exposed reload endpoint on this build." },
  { name: "reload-mcp", category: "tools", description: "Reload MCP server connections.", surface: ["telegram", "cli"], risk: "state-changing", status: "unsupported", note: "No exposed reload endpoint on this build; toggling a server off/on via /tools is the closest real action." },
  { name: "cron", category: "tools", description: "List/manage scheduled jobs.", surface: ["telegram", "cli", "ui"], risk: "state-changing", status: "available", note: "Real: GET/POST/DELETE /api/cron/jobs — same as the Jobs page." },
  { name: "curator", category: "tools", description: "Background skill-maintenance status.", surface: ["telegram", "cli"], risk: "safe", status: "unsupported", note: "`hermes curator` exists on the CLI; not exposed to the dashboard bridge." },
  { name: "kanban", category: "tools", description: "List/manage the Kanban board.", surface: ["telegram", "cli", "ui"], risk: "state-changing", status: "available", note: "Real: SSH-exec'd `hermes kanban` CLI — same bridge as the Kanban tab." },
  { name: "plugins", category: "tools", description: "List/manage installed plugins.", surface: ["telegram", "cli"], risk: "state-changing", status: "unsupported", note: "`hermes plugins` exists on the CLI; not exposed to the dashboard bridge." },

  // ---- Gateway --------------------------------------------------------------
  { name: "approve", category: "gateway", description: "Approve a pending dangerous action or pairing request.", paramHint: "<id>", surface: ["telegram", "cli"], risk: "dangerous", status: "requires_backend", note: "Real pairing-approval endpoint exists (POST /api/pairing/approve) for DM pairing codes specifically; see the Safety Center (Approvals tab) for what's actually wired." },
  { name: "deny", category: "gateway", description: "Deny a pending dangerous action or pairing request.", paramHint: "<id>", surface: ["telegram", "cli"], risk: "dangerous", status: "requires_backend", note: "Counterpart to /approve — see the Safety Center." },
  { name: "restart", category: "gateway", description: "Restart the messaging gateway.", surface: ["telegram", "cli", "ui"], risk: "dangerous", status: "available", note: "Real: POST /api/gateway/restart, same action already on the System page. Drops every live platform connection for a few seconds." },
  { name: "sethome", category: "gateway", description: "Set the default reply chat/channel.", surface: ["telegram", "cli"], risk: "state-changing", status: "unsupported", note: "Platform-adapter setting, no exposed endpoint." },
  { name: "update", category: "gateway", description: "Update Hermes to the latest version.", surface: ["cli"], risk: "dangerous", status: "unsupported", note: "`hermes update` exists on the CLI only — running it from a web button on the live box is out of scope here." },
  { name: "topic", category: "gateway", description: "Set the forum-topic routing for this chat.", surface: ["telegram"], risk: "safe", status: "unsupported", note: "Telegram-specific forum-topic feature." },
  { name: "platforms", category: "gateway", description: "List configured messaging platforms and their connection state.", surface: ["telegram", "cli", "ui"], risk: "safe", status: "available", note: "Real: GET /api/messaging/platforms — same as the System page." },
  { name: "gateway", category: "gateway", description: "Gateway start/stop/status.", surface: ["cli", "ui"], risk: "dangerous", status: "requires_backend", note: "Real endpoints exist (POST /api/gateway/start, /stop, /drain) but only /restart is wired into this UI so far." },

  // ---- Utility / info ---------------------------------------------------------
  { name: "branch", category: "utility", description: "Show/switch the git branch a worktree session is on.", surface: ["cli"], risk: "safe", status: "unsupported", note: "CLI worktree feature (`hermes -w`), not a web UI concept here." },
  { name: "fork", category: "utility", description: "Fork the current session into a new one.", surface: ["telegram", "cli"], risk: "safe", status: "unsupported", note: "Session-adapter command, no web UI equivalent." },
  { name: "handoff", category: "utility", description: "Hand the session off to another profile/agent.", surface: ["telegram", "cli"], risk: "state-changing", status: "unsupported", note: "Session-adapter command, no web UI equivalent." },
  { name: "fast", category: "utility", description: "Toggle a faster, lower-effort model mode.", surface: ["telegram", "cli"], risk: "safe", status: "unsupported", note: "No exposed config endpoint for this on the current build." },
  { name: "browser", category: "utility", description: "Open/attach a browser-use session.", surface: ["telegram", "cli"], risk: "state-changing", status: "unsupported", note: "CLI/computer-use feature, not exposed to this web UI." },
  { name: "history", category: "utility", description: "Show recent session history.", surface: ["telegram", "cli", "ui"], risk: "safe", status: "available", note: "This UI's own session drawer already shows real chat history." },
  { name: "save", category: "utility", description: "Save the current conversation export.", surface: ["telegram", "cli", "ui"], risk: "safe", status: "available", note: "Real: this UI's chat export (src/lib/exportChat.js) already does this." },
  { name: "copy", category: "utility", description: "Copy the last response to clipboard.", surface: ["telegram", "cli"], risk: "safe", status: "unsupported", note: "Telegram/CLI-client-local action." },
  { name: "paste", category: "utility", description: "Paste clipboard content into the composer.", surface: ["telegram", "cli"], risk: "safe", status: "unsupported", note: "Telegram/CLI-client-local action; the browser's own paste already works in this UI's composer." },
  { name: "image", category: "utility", description: "Attach an image to the next message.", surface: ["telegram", "cli", "ui"], risk: "safe", status: "available", note: "This UI's chat composer already supports real image attachments." },
  { name: "help", category: "utility", description: "Show this command list.", surface: ["telegram", "cli", "ui"], risk: "safe", status: "available", note: "Opens this palette." },
  { name: "commands", category: "utility", description: "Alias for /help.", surface: ["telegram", "cli", "ui"], risk: "safe", status: "available", note: "Opens this palette." },
  { name: "usage", category: "utility", description: "Show token usage and cost.", surface: ["telegram", "cli", "ui"], risk: "safe", status: "available", note: "Real usage data already tracked in this UI (System Overview usage rings)." },
  { name: "insights", category: "utility", description: "Show usage insights and analytics.", surface: ["cli", "ui"], risk: "safe", status: "requires_backend", note: "Real endpoints exist (GET /api/analytics/usage, /api/analytics/models) via the dashboard bridge but aren't surfaced as their own view yet." },
  { name: "status", category: "utility", description: "Show status of all components.", surface: ["telegram", "cli", "ui"], risk: "safe", status: "available", note: "Opens System Overview — gateway health, machine stats, platforms, jobs, tools, memory, all real." },
  { name: "profile", category: "utility", description: "Show/switch the active profile.", surface: ["telegram", "cli", "ui"], risk: "safe", status: "available", note: "Real: GET /api/profiles — same as System Overview's Model/Profile card." },
  { name: "debug", category: "utility", description: "Dump debug/system info for support.", surface: ["cli"], risk: "safe", status: "unsupported", note: "`hermes debug share` exists on the CLI; not something to expose from a public-ish web palette." },

  // ---- Exit -------------------------------------------------------------------
  { name: "quit", category: "exit", description: "Exit the current CLI/Telegram session.", surface: ["telegram", "cli"], risk: "safe", status: "unsupported", note: "Not a web UI concept — close the tab instead." },
  { name: "exit", category: "exit", description: "Alias for /quit.", surface: ["telegram", "cli"], risk: "safe", status: "unsupported", note: "Not a web UI concept — close the tab instead." },
  { name: "q", category: "exit", description: "Alias for /quit.", surface: ["telegram", "cli"], risk: "safe", status: "unsupported", note: "Not a web UI concept — close the tab instead." },
];
