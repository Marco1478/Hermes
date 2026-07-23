/*
  projectContext — builds the real, visible context message seeded into
  Hermes chat for a project ("Analyze in Chat" / "Start Hermes chat for
  this project"). Shared by ProjectChatPanel.jsx and
  ProjectIntelligencePanel.jsx so both surfaces hand Hermes the exact
  same facts, built the same way, instead of two hand-maintained copies
  drifting apart. Every line here traces to a real fetched value — no
  field is invented, and no LLM-generated summary is included (none
  exists on this backend; see ProjectIntelligencePanel's own header
  comment for the route check).
*/
export function buildProjectContextMessage(project, linkedNotes, canvases, workflows, tasks, assets = []) {
  const activeWorkflows = workflows.filter((w) => w.status !== "done");
  const blockedSteps = workflows.flatMap((w) => (w.steps || []).filter((s) => s.status === "blocked").map((s) => `${s.title || "untitled step"} (${w.name})`));
  const openTasks = tasks.filter((t) => t.status !== "done");
  const blockedTasks = tasks.filter((t) => t.status === "blocked");

  const lines = [
    "Project context loaded:",
    `- Project: ${project.name || "Untitled project"}`,
    `- Obsidian folder: Hermes/Projects/${project.name}`,
    `- Overview: Hermes/Projects/${project.name}/overview.md`,
    `- Status: ${project.status} · priority: ${project.priority}`,
  ];

  if (project.tags?.length) lines.push(`- Tags: ${project.tags.join(", ")}`);

  lines.push(`- Notes (${linkedNotes.length}): ${linkedNotes.length ? linkedNotes.map((n) => n.title || "Untitled").join(", ") : "none linked"}`);
  lines.push(`- Canvases (${canvases.length}): ${canvases.length ? canvases.map((c) => c.name).join(", ") : "none"}`);
  lines.push(
    `- Workflows (${workflows.length}, ${activeWorkflows.length} active): ${workflows.length ? workflows.map((w) => `${w.name} [${w.status}]`).join(", ") : "none"}`
  );
  if (blockedSteps.length) lines.push(`  Blocked steps: ${blockedSteps.join("; ")}`);

  lines.push(`- Kanban (${tasks.length} linked, ${openTasks.length} open, ${blockedTasks.length} blocked)`);
  if (blockedTasks.length) lines.push(`  Blocked tasks: ${blockedTasks.map((t) => `${t.id} — ${t.title}`).join("; ")}`);

  lines.push(`- Assets (${assets.length}): ${assets.length ? assets.map((a) => a.name).join(", ") : "none uploaded"}`);

  if (project.description) lines.push("", project.description);
  lines.push("", "When answering, use this project as the active context.");
  return lines.join("\n");
}
