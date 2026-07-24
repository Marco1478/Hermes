/*
  projectColor — the one place a project's `color` (one of the swatch keys
  in ProjectOverviewPanel.jsx's COLORS, or null) maps to an actual paintable
  value. Reused wherever "this project, distinguishable by its own color"
  matters: Kanban project chips, the project workspace's Home button, and
  Project Home's cozy header glow — same five values note-color-dot/
  note-color-swatch already use in NotesPage.css, just resolved to a CSS
  value instead of a class name for spots that need it inline.
*/
const COLOR_VAR = {
  teal: "var(--teal)",
  warn: "var(--warn)",
  bad: "var(--bad)",
  ok: "var(--ok)",
  violet: "#b6a6e8",
};

export function projectColorVar(color) {
  return COLOR_VAR[color] || "var(--teal)";
}
