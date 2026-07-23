/*
  projectContext — builds the real, visible context message seeded into
  Hermes chat for a project ("Analyze in Chat" / "Start Hermes chat for
  this project" / the contextual action buttons in ProjectChatPanel.jsx,
  CLAUDE-005 of Instructions 009). Shared by every surface that seeds a
  chat message so they all hand Hermes the exact same facts, built the
  same way, instead of hand-maintained copies drifting apart. Every line
  here traces to a real fetched value — no field is invented, and no
  LLM-generated summary is included (none exists on this backend; see
  ProjectIntelligencePanel's own header comment for the route check).

  `instruction` is the one thing that changes per action button — it's a
  plain, visible line appended at the end asking Hermes to DO something
  with the facts above, not a hidden system prompt. Marco sees and can
  edit it before Send, same as the rest of the message.
*/
export function buildProjectContextMessage(project, linkedNotes, canvases, workflows, tasks, assets = [], instruction = null) {
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
  for (const c of canvases) {
    const nodeTitles = (c.nodes || []).map((n) => n.title || `untitled ${n.type}`).filter(Boolean);
    if (nodeTitles.length) lines.push(`  "${c.name}" nodes: ${nodeTitles.join(", ")}`);
  }

  lines.push(
    `- Workflows (${workflows.length}, ${activeWorkflows.length} active): ${workflows.length ? workflows.map((w) => `${w.name} [${w.status}]`).join(", ") : "none"}`
  );
  for (const w of workflows) {
    const stepTitles = (w.steps || []).map((s) => `${s.title || "untitled step"} [${s.status}]`);
    if (stepTitles.length) lines.push(`  "${w.name}" steps: ${stepTitles.join(", ")}`);
  }
  if (blockedSteps.length) lines.push(`  Blocked steps: ${blockedSteps.join("; ")}`);

  lines.push(`- Kanban (${tasks.length} linked, ${openTasks.length} open, ${blockedTasks.length} blocked)`);
  if (blockedTasks.length) lines.push(`  Blocked tasks: ${blockedTasks.map((t) => `${t.id} — ${t.title}`).join("; ")}`);

  lines.push(`- Assets (${assets.length}): ${assets.length ? assets.map((a) => a.name).join(", ") : "none uploaded"}`);

  if (project.description) lines.push("", project.description);
  lines.push("", instruction || "When answering, use this project as the active context.");
  return lines.join("\n");
}
