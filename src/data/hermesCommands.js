/*
  HERMES_COMMANDS — slash-command autocomplete data for the chat composer.
  It mirrors the full command registry used by the global Command Palette so
  typing / in chat now exposes the same command surface instead of an empty
  dead menu.
*/
import { COMMANDS } from "./commandRegistry.js";

export const HERMES_COMMANDS = COMMANDS;
