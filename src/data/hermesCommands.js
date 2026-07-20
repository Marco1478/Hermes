/*
  HERMES_COMMANDS — the slash-command list for the composer's
  autocomplete palette (see components/chat/CommandPalette.jsx).

  Empty until Marco supplies the real list Hermes actually supports in
  chat/Telegram (e.g. /sessions, /resume — seen referenced in the
  hermes-webui changelog — but the exact current set and their argument
  shapes need to come from him, no server endpoint exposes this; probed
  and got 404 on every guess).

  Shape: { name: "sessions", description: "List recent sessions" }
  `name` is what's typed after "/"; keep it lowercase, no spaces.
*/
export const HERMES_COMMANDS = [];
