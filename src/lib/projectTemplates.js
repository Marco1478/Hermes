/*
  projectTemplates — starting points for "+ new project", not fixed types:
  a template only pre-fills the New Project form (description/color/tags)
  and, once the project exists, best-effort scaffolds real starter content
  (workflow, canvas, notes, Kanban tasks) via the same
  writeVaultWorkflow/writeVaultCanvas/createNote+linkNote/
  createKanbanTask+linkTask calls the Workflows/Canvas/Notes/Kanban tabs
  themselves use — see NewProjectModal in ProjectsPage.jsx. Every field it
  touches stays a normal, editable project field afterward — nothing here
  is a separate "template type" the project remembers, and none of it is
  fictional filler: a starter note is a real, short, genuinely useful
  starting doc (a brief to fill in), not sample lorem-ipsum content.
*/

function uid(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function step(title) {
  return { id: uid("step"), title, description: "", owner: "marco", status: "todo", linkedNoteId: null, linkedCanvasId: null, linkedTaskId: "", command: "" };
}

function card(title, x, y) {
  return { id: uid("node"), type: "card", x, y, w: 220, h: 130, title, body: "", color: "teal", tags: [], checklist: [], ref: null };
}

export const PROJECT_TEMPLATES = [
  {
    key: "generic",
    label: "Generic",
    summary: "Blank project — no starter content.",
    color: null,
    tags: [],
    overview: "",
    workflow: null,
    canvas: null,
    notes: [],
    kanbanTasks: [],
  },
  {
    key: "hermes-feature",
    label: "Hermes feature",
    summary: "A feature/change to Hermes itself, start to push.",
    color: "teal",
    tags: ["hermes-feature"],
    overview: "## Objective\n\n## Scope\n\n## Blockers\n\n## Verification\n",
    workflow: {
      name: "Feature workflow",
      steps: ["Research", "Implement", "Build", "Browser QA", "Smoke tests", "Push"].map(step),
    },
    canvas: {
      name: "Architecture map",
      nodes: [card("Entry point", 60, 60), card("Core logic", 340, 60), card("Storage / bridge", 620, 60)],
    },
    notes: [{ title: "Feature brief", body: "## What\n\n## Why\n\n## Risks\n\n## Rollback plan\n" }],
    kanbanTasks: ["Write the Claude instructions for this feature", "Implement and build", "Browser QA + smoke tests", "Push"],
  },
  {
    key: "web-client",
    label: "Web Client Project",
    summary: "A website/app built for a client.",
    color: "violet",
    tags: ["client", "web"],
    overview: "## Objective\n\n## Scope\n\n## Stack\n\n## Deadline\n",
    workflow: {
      name: "Client project workflow",
      steps: ["Discovery", "Design", "Build", "Client review", "Launch"].map(step),
    },
    canvas: null,
    notes: [{ title: "Client brief", body: "## Client\n\n## Goals\n\n## Budget\n\n## Key contacts\n" }],
    kanbanTasks: ["Discovery call", "Send proposal / scope doc", "Build MVP", "Client review round 1", "Launch"],
  },
  {
    key: "ai-video",
    label: "AI Video / Ad Campaign",
    summary: "AI-generated video work (Higgsfield or similar) or an ad campaign.",
    color: "warn",
    tags: ["ai-video", "higgsfield"],
    overview: "## Concept\n\n## Style references\n\n## Shot list\n\n## Output spec\n",
    workflow: {
      name: "Video production workflow",
      steps: ["Concept", "Prompt drafts", "Generate", "Review + select", "Edit + post", "Deliver"].map(step),
    },
    canvas: null,
    notes: [{ title: "Creative brief", body: "## Concept\n\n## References\n\n## Shot list\n\n## Output spec (length, aspect ratio, platform)\n" }],
    kanbanTasks: ["Draft prompts", "Generate first batch", "Review + select best takes", "Edit + post-production", "Deliver"],
  },
  {
    key: "business-outreach",
    label: "Business Outreach",
    summary: "Reaching out to prospects/partners.",
    color: "ok",
    tags: ["outreach"],
    overview: "## Target\n\n## Goal\n\n## Channels\n\n## Follow-up plan\n",
    workflow: {
      name: "Outreach workflow",
      steps: ["Research targets", "Draft message", "Send", "Follow up", "Track responses"].map(step),
    },
    canvas: null,
    notes: [{ title: "Target list", body: "## Target profile\n\n## Prospects\n\n- \n\n## Channels\n" }],
    kanbanTasks: ["Research targets", "Draft outreach message", "Send first batch", "Follow up", "Track responses"],
  },
  {
    key: "learning-research",
    label: "Learning / Research",
    summary: "Studying a topic, evaluating options, or writing up findings.",
    color: null,
    tags: ["research"],
    overview: "## Question\n\n## Why it matters\n\n## Sources\n\n## Findings\n\n## Conclusion\n",
    workflow: {
      name: "Research workflow",
      steps: ["Define the question", "Gather sources", "Read / experiment", "Write up findings", "Decide / conclude"].map(step),
    },
    canvas: null,
    notes: [{ title: "Research log", body: "## Question\n\n## Sources\n\n- \n\n## Notes\n\n## Open questions\n" }],
    kanbanTasks: ["Define the research question", "Gather sources", "Write up findings", "Reach a conclusion"],
  },
  {
    key: "portfolio-demo",
    label: "Content / Portfolio",
    summary: "A demo or portfolio piece to show off.",
    color: "bad",
    tags: ["portfolio", "demo"],
    overview: "## Goal\n\n## Audience\n\n## Demo flow\n\n## Polish checklist\n",
    workflow: {
      name: "Demo workflow",
      steps: ["Outline", "Build core flow", "Polish UI", "Record / rehearse demo", "Publish"].map(step),
    },
    canvas: null,
    notes: [{ title: "Demo outline", body: "## Goal\n\n## Audience\n\n## Flow (step by step)\n\n## Polish checklist\n" }],
    kanbanTasks: ["Outline the demo flow", "Build core flow", "Polish UI", "Record / rehearse", "Publish"],
  },
];
