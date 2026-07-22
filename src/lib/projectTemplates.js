/*
  projectTemplates — starting points for "+ new project", not fixed types:
  a template only pre-fills the New Project form (description/color/tags)
  and, once the project exists, best-effort scaffolds a starter workflow
  (and for "Hermes feature", a starter canvas) via the same real
  writeVaultWorkflow/writeVaultCanvas calls the Workflows/Canvas tabs use.
  Every field it touches stays a normal, editable project field afterward —
  nothing here is a separate "template type" the project remembers.
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
  },
  {
    key: "web-client",
    label: "Web client project",
    summary: "A website/app built for a client.",
    color: "violet",
    tags: ["client", "web"],
    overview: "## Objective\n\n## Scope\n\n## Stack\n\n## Deadline\n",
    workflow: {
      name: "Client project workflow",
      steps: ["Discovery", "Design", "Build", "Client review", "Launch"].map(step),
    },
    canvas: null,
  },
  {
    key: "ai-video",
    label: "AI video / Higgsfield project",
    summary: "AI-generated video work (Higgsfield or similar).",
    color: "warn",
    tags: ["ai-video", "higgsfield"],
    overview: "## Concept\n\n## Style references\n\n## Shot list\n\n## Output spec\n",
    workflow: {
      name: "Video production workflow",
      steps: ["Concept", "Prompt drafts", "Generate", "Review + select", "Edit + post", "Deliver"].map(step),
    },
    canvas: null,
  },
  {
    key: "business-outreach",
    label: "Business outreach",
    summary: "Reaching out to prospects/partners.",
    color: "ok",
    tags: ["outreach"],
    overview: "## Target\n\n## Goal\n\n## Channels\n\n## Follow-up plan\n",
    workflow: {
      name: "Outreach workflow",
      steps: ["Research targets", "Draft message", "Send", "Follow up", "Track responses"].map(step),
    },
    canvas: null,
  },
  {
    key: "portfolio-demo",
    label: "Portfolio/demo project",
    summary: "A demo or portfolio piece to show off.",
    color: "bad",
    tags: ["portfolio", "demo"],
    overview: "## Goal\n\n## Audience\n\n## Demo flow\n\n## Polish checklist\n",
    workflow: {
      name: "Demo workflow",
      steps: ["Outline", "Build core flow", "Polish UI", "Record / rehearse demo", "Publish"].map(step),
    },
    canvas: null,
  },
];
