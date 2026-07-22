# Claude Instructions 005 — Project Workspaces, Custom Canvas, Glass UI, and Contextual Hermes Chat

## Context

Marco approved the next evolution after Obsidian-backed Notes/Projects. The current goal is to organize the new sections into a coherent operating system instead of a linear pile of tabs.

Primary decisions from Marco:

- Notes must remain usable as **free notes**, not forced inside a project.
- Projects should become a dedicated **workspace** with its own internal sidebar.
- System Overview, Notes, and Projects should use a cohesive glassmorphism visual language.
- Canvas should be **custom**, not Obsidian desktop `.canvas`, because Marco does not plan to use Obsidian desktop directly.
- Project workspaces must support notes/imports, custom canvases, workflows, per-project Kanban, and a project-aware Hermes chat.
- Project Kanban tasks should appear in the main Kanban too, visually distinguished by project tag/color.

## Product North Star

Projects are not just cards. A Project is a self-contained operational space:

```text
Project Workspace
  → overview
  → project notes / imported notes
  → custom canvas
  → workflows
  → project Kanban
  → contextual Hermes chat
  → Obsidian-backed persistence
```

Notes remain a global knowledge base. A note can be free-floating or linked to one/many projects.

Obsidian is the durable brain. The UI is the command surface. Hermes is the reasoning engine. Kanban is the action layer.

## Operating Rules

- Work chunks in numeric order unless a chunk is blocked and a later chunk is independent.
- Verify each chunk before moving to the next.
- Commit locally after each verified chunk.
- If blocked by missing backend/API/env, create a concise blocker status file and continue on independent chunks.
- Push to GitHub only once after the whole instruction file is completed or all blockers are documented.
- Do not commit `.env.local`, credentials, tokens, private vault contents, generated user notes, or private project data.
- Do not fake persistence. If Obsidian/vault/backend is unavailable, show a diagnostic state.
- Do not create a localStorage-only feature and present it as durable. Cache is allowed; source of truth should be Obsidian/vault/backend where configured.
- UX must be verified visually in browser, not only by build.

---

## CLAUDE-001 — Glassmorphism unification pass for System Overview, Notes, and Projects

**Objective:**

Create a cohesive premium glassmorphism language for the three dense knowledge/workspace surfaces: System Overview, Notes, and Projects.

**Files likely involved:**

- `src/styles/global.css`
- `src/components/PageShell.css`
- `src/components/system/SystemOverviewPage.jsx`
- `src/components/system/SystemOverviewPage.css`
- `src/components/notes/NotesPage.jsx`
- `src/components/notes/NotesPage.css`
- `src/components/projects/ProjectsPage.jsx`
- `src/components/projects/ProjectsPage.css`
- reusable shared components if needed

**Implementation notes:**

- Use a disciplined glass style:
  - translucent dark panels;
  - subtle blur on major surfaces only;
  - teal/cyan edge glow;
  - crisp readable typography;
  - strong hover/focus states;
  - smooth motion without heavy GPU abuse.
- Avoid the lazy-glass trap: everything transparent, low contrast, blurred soup. That would be pretty trash wearing a tuxedo.
- System Overview should feel like an executive cockpit.
- Notes should feel like a premium knowledge editor/library.
- Projects should feel like a workspace launchpad.
- Preserve left rail clarity and responsive behavior.

**Verification gate:**

- `npm run build` passes.
- Browser QA on System Overview, Notes, and Projects:
  - no overlap;
  - text readable;
  - hover/focus visible;
  - mobile/responsive not destroyed;
  - sidebar/left rail still usable.
- Browser console has zero JS errors.

**Commit rule:**

Commit when verified with message:

```text
style: unify glass UI for system notes and projects
```

---

## CLAUDE-002 — Rebuild Projects as dedicated workspaces with internal sidebar

**Objective:**

Turn Projects from a list/card surface into a true workspace system.

**Files likely involved:**

- `src/components/projects/ProjectsPage.jsx`
- `src/components/projects/ProjectsPage.css`
- `src/state/Projects.jsx`
- `src/lib/obsidianBridge.js`
- `vite-plugins/obsidianBridge.js`
- new components under `src/components/projects/`

**Implementation notes:**

- Projects list should have a clear `+ New Project` affordance similar to Kanban.
- Creating a project should be easy:
  - name;
  - description;
  - status;
  - color;
  - tags;
  - optional template.
- Clicking a project opens a dedicated workspace/detail view.
- Workspace should have its own internal sidebar, not just top tabs:

```text
Project Workspace
  Overview
  Notes
  Canvas
  Workflows
  Kanban
  Chat
  Intelligence
```

- Include a clear back action to Projects list.
- Project workspace should load/persist through Obsidian-backed project structure.
- Recommended folder structure:

```text
Hermes/Projects/<Project Name>/
  overview.md
  notes/
  canvases/
  workflows/
  assets/
  kanban.md
```

- Project creation should create the folder structure when vault is configured.
- If vault is missing, show diagnostic and allow local preview/cache only if clearly labeled.

**Verification gate:**

- Create project in UI → project appears.
- If vault configured, folder/files are created under Obsidian vault.
- Refresh page → project persists from vault.
- Workspace sidebar navigation works.
- Empty workspace states are useful and have clear `+` actions.
- `npm run build` passes.
- Browser console zero errors.

**Commit rule:**

Commit when verified with message:

```text
feat: add dedicated project workspaces
```

---

## CLAUDE-003 — Preserve free notes and add project note/import workflow

**Objective:**

Keep Notes as a global free knowledge base while allowing notes to be linked/imported into project workspaces.

**Files likely involved:**

- `src/state/Notes.jsx`
- `src/state/Projects.jsx`
- `src/components/notes/NotesPage.jsx`
- `src/components/projects/ProjectNotesPanel.jsx`
- `src/lib/obsidianBridge.js`
- `vite-plugins/obsidianBridge.js`

**Implementation notes:**

- Notes must support two states:
  - free/global note;
  - linked to one or more projects.
- Do **not** force every note into a project.
- In a project workspace, Notes section should support:
  - create project note;
  - link existing global note;
  - import markdown/text into project notes;
  - unlink note without deleting the original.
- Metadata/frontmatter should support project references:

```yaml
---
type: note
tags: [design, idea]
projects:
  - Hermes Custom UI
source: hermes-ui
---
```

- For imported notes, store source metadata where safe and useful.
- Avoid duplicate notes when linking existing notes.
- Global Notes tab should be able to filter by:
  - all notes;
  - free notes;
  - project-linked notes;
  - tag;
  - folder/status.

**Verification gate:**

- Create free note → stays visible in global Notes and is not assigned to a project.
- Link free note to project → appears inside project but remains global.
- Unlink note → removed from project view, not deleted.
- Import markdown/text into project → saved under vault and visible in project notes.
- Refresh page → links persist.
- `npm run build` passes.

**Commit rule:**

Commit when verified with message:

```text
feat: link free notes into project workspaces
```

---

## CLAUDE-004 — Add custom project canvas system

**Objective:**

Build a custom canvas feature inside each project workspace, saved to Obsidian/vault as JSON markdown-adjacent project data.

**Files likely involved:**

- new `src/components/projects/canvas/ProjectCanvas.jsx`
- new `src/components/projects/canvas/ProjectCanvas.css`
- `src/state/Projects.jsx`
- `src/lib/obsidianBridge.js`
- `vite-plugins/obsidianBridge.js`
- maybe shared drag/drop utilities

**Canvas requirements:**

- Canvas list inside project.
- Create canvas with:
  - name;
  - description;
  - tags.
- Canvas view with:
  - grid background;
  - pan/zoom if feasible;
  - draggable nodes;
  - draggable whole canvas tabs/cards, not just tiny dot handles;
  - smooth motion/hover/focus states.
- Add node types:
  - text box;
  - sticky note;
  - rectangle/card;
  - decision/diamond;
  - circle;
  - checklist block;
  - image/reference card;
  - file/reference card;
  - Obsidian note reference;
  - Kanban task reference.
- Shape presets panel should be rich and easy to understand.
- Nodes should support edit title/body/color/tags where relevant.
- Save canvas persistently.

**Persistence format:**

Use a custom JSON format, not Obsidian desktop `.canvas`, because Marco does not plan to work inside Obsidian desktop.

Recommended path:

```text
Hermes/Projects/<Project Name>/canvases/<canvas-slug>.canvas.json
```

Recommended shape:

```json
{
  "version": 1,
  "type": "hermes-project-canvas",
  "name": "Architecture map",
  "description": "Project flow and references",
  "tags": ["architecture", "ui"],
  "nodes": [
    {
      "id": "node_...",
      "type": "text",
      "x": 120,
      "y": 160,
      "w": 280,
      "h": 140,
      "title": "Bridge layer",
      "body": "Filesystem-backed Obsidian bridge",
      "color": "teal",
      "tags": ["backend"]
    }
  ],
  "edges": []
}
```

**Implementation constraints:**

- Keep it robust before making it infinite.
- If image/file upload pipeline is not ready, support image/file reference cards first:
  - URL reference;
  - existing vault asset path;
  - linked note/file reference.
- Do not block the entire canvas feature on binary upload.
- Save often enough to feel alive, but debounce writes to avoid file churn.

**Verification gate:**

- Create canvas → JSON file exists in project folder.
- Add text node → persists after refresh.
- Drag node → position persists.
- Add at least 3 shape presets → persist after refresh.
- Add note reference node → resolves/display safe reference.
- Browser QA confirms canvas is smooth, readable, and not visually broken.
- `npm run build` passes.

**Commit rule:**

Commit when verified with message:

```text
feat: add custom project canvas workspaces
```

---

## CLAUDE-005 — Add project workflow builder

**Objective:**

Add a workflow section inside project workspaces for structured execution maps.

**Files likely involved:**

- new `src/components/projects/workflows/ProjectWorkflows.jsx`
- new `src/components/projects/workflows/ProjectWorkflows.css`
- `src/state/Projects.jsx`
- `src/lib/obsidianBridge.js`
- `vite-plugins/obsidianBridge.js`

**Implementation notes:**

- Workflow list inside project.
- Create workflow with:
  - name;
  - description;
  - tags;
  - status.
- Workflow steps should support:
  - title;
  - description;
  - owner: Marco / Hermes / Claude / external;
  - status: todo / active / blocked / done;
  - linked note;
  - linked canvas;
  - linked Kanban task;
  - optional command/action text.
- Make step cards reorderable by dragging the whole step card, not only a tiny handle.
- Save workflows under:

```text
Hermes/Projects/<Project Name>/workflows/<workflow-slug>.workflow.json
```

- If JSON feels too heavy, also write a readable markdown summary file, but do not duplicate source-of-truth logic carelessly.

**Verification gate:**

- Create workflow → file exists.
- Add/reorder/update steps → persists after refresh.
- Link step to note/canvas/task → visible and survives reload.
- `npm run build` passes.
- Browser console zero errors.

**Commit rule:**

Commit when verified with message:

```text
feat: add project workflow builder
```

---

## CLAUDE-006 — Add project-aware Hermes chat entrypoint

**Objective:**

From every project workspace, Marco must be able to start a Hermes chat where the assistant immediately understands the project context and Obsidian references.

**Files likely involved:**

- `src/components/projects/ProjectChatPanel.jsx`
- `src/components/chat/ChatContainer.jsx`
- `src/state/Chat.jsx`
- `src/lib/obsidianBridge.js`
- `src/lib/hermesBridge.js`
- `src/App.jsx`

**Implementation notes:**

- Add a clear `Start Hermes chat for this project` action inside project workspace.
- It should open/switch to chat and seed the conversation with a structured project context message.
- Include:
  - project name;
  - project overview path;
  - Obsidian project folder path;
  - linked notes summary;
  - active workflows summary;
  - active Kanban tasks summary;
  - canvas list;
  - tags.
- The message should be explicit and readable, for example:

```md
Project context loaded:
- Project: Hermes Custom UI
- Obsidian folder: Hermes/Projects/Hermes Custom UI
- Overview: Hermes/Projects/Hermes Custom UI/overview.md
- Notes: 6 linked notes
- Canvases: 2
- Workflows: 1 active
- Kanban: 8 open tasks

When answering, use this project as the active context.
```

- If a real session/context API exists, use it. If not, seed the chat locally with a clear context message and route the user's next request through the existing chat bridge.
- Do not pretend to attach files/context if the backend does not support it; state what is being sent.

**Verification gate:**

- From project workspace, click start chat.
- Chat opens with project context visible.
- User can send follow-up message.
- Missing notes/canvas/workflows do not crash the context builder.
- `npm run build` passes.

**Commit rule:**

Commit when verified with message:

```text
feat: start Hermes chat from project context
```

---

## CLAUDE-007 — Add tag-driven access across notes, workflows, canvases, and projects

**Objective:**

Make tags a real cross-object navigation layer.

**Files likely involved:**

- `src/state/Notes.jsx`
- `src/state/Projects.jsx`
- `src/components/notes/NotesPage.jsx`
- `src/components/projects/ProjectsPage.jsx`
- new shared tag components if needed

**Implementation notes:**

- Tags should apply to:
  - free notes;
  - project notes;
  - projects;
  - canvases;
  - workflows;
  - workflow steps where useful;
  - Kanban tasks where supported.
- Project workspace should include a tag explorer/filter:

```text
#design → notes, canvases, workflows, tasks
#blocked → blockers across this project
#claude → Claude-related execution items
```

- Global Notes should keep tag filtering.
- Projects list should support tag filtering.
- Do not create inconsistent tag storage across object types. Normalize tag strings.

**Verification gate:**

- Add tag to note/canvas/workflow/project.
- Filter by tag inside project.
- Filter by tag globally where available.
- Tags survive refresh.
- `npm run build` passes.

**Commit rule:**

Commit when verified with message:

```text
feat: add tag navigation for project knowledge
```

---

## CLAUDE-008 — Add per-project Kanban with main Kanban mirroring

**Objective:**

Every project should have its own Kanban view, while project tasks still appear in the main Kanban with project color/tag distinction.

**Files likely involved:**

- `src/components/kanban/KanbanPage.jsx`
- `src/components/kanban/KanbanPage.css`
- `src/components/projects/ProjectKanbanPanel.jsx`
- `src/lib/kanbanBridge.js`
- `vite-plugins/kanbanBridge.js`
- `src/state/Projects.jsx`

**Implementation notes:**

- Project workspace Kanban filters tasks by project reference/tag/color.
- Creating a task from project Kanban should also create it in the real/main Kanban system.
- Main Kanban should show all tasks, including project tasks.
- Project tasks in main Kanban should display:
  - project chip;
  - project color edge/glow;
  - project tag.
- If the real Kanban backend supports labels/tags/comments but not `projectId`, persist project relation using the safest real mechanism available:
  - tag;
  - comment;
  - metadata if supported.
- Do not invent local-only task fields if the backend cannot persist them.
- If project relation cannot be persisted robustly, create a clear blocker/status note rather than faking it.

**Verification gate:**

- Create task in project Kanban → appears in main Kanban.
- Main Kanban visually distinguishes project task.
- Project Kanban only shows tasks for that project.
- Task survives refresh/backend reload.
- `npm run smoke` includes a reversible project Kanban check if possible.
- `npm run build` passes.

**Commit rule:**

Commit when verified with message:

```text
feat: add project-scoped Kanban with main board mirroring
```

---

## CLAUDE-009 — Add Project Intelligence panel

**Objective:**

Add a lightweight but useful intelligence panel inside each project: the concise operational summary Hermes/Marco need before acting.

**Files likely involved:**

- `src/components/projects/ProjectIntelligencePanel.jsx`
- `src/components/projects/ProjectsPage.jsx`
- `src/lib/obsidianBridge.js`
- `src/lib/kanbanBridge.js`

**Implementation notes:**

- This is not an LLM feature unless a real backend route exists. Start with deterministic summaries from project data.
- Show:
  - what this project is;
  - active notes count;
  - active workflows;
  - open Kanban tasks;
  - blocked tasks/steps;
  - last updated note/canvas/workflow;
  - suggested next action placeholder if deterministic.
- If Hermes analysis endpoint exists, add optional `Ask Hermes to summarize this project`; otherwise show diagnostic/explanation.

**Verification gate:**

- Project Intelligence panel loads with empty and populated project.
- Counts match project data.
- Missing backend analysis route does not fake LLM summary.
- `npm run build` passes.

**Commit rule:**

Commit when verified with message:

```text
feat: add project intelligence panel
```

---

## CLAUDE-010 — Add project templates

**Objective:**

When Marco creates a project, it should not start as a dead empty shell.

**Files likely involved:**

- `src/components/projects/ProjectCreateModal.jsx`
- `src/state/Projects.jsx`
- `src/lib/obsidianBridge.js`
- `vite-plugins/obsidianBridge.js`

**Templates to include:**

```text
Generic
Hermes feature
Web client project
AI video / Higgsfield project
Business outreach
Portfolio/demo project
```

**Implementation notes:**

- Template selects default folders, overview sections, starter tags, starter workflows, and optional canvas.
- Example `Hermes feature` template:
  - overview.md with objective/scope/blockers/verification;
  - workflow: research → implement → build → browser QA → smoke → push;
  - canvas: architecture map starter;
  - project color teal.
- Keep templates editable after creation.

**Verification gate:**

- Create project from each template → structure exists and UI renders.
- Template data persists in vault.
- No private/secret content inserted.
- `npm run build` passes.

**Commit rule:**

Commit when verified with message:

```text
feat: add project creation templates
```

---

## CLAUDE-011 — Extend smoke tests and docs for project workspaces

**Objective:**

Make this ambitious feature testable and durable.

**Files likely involved:**

- `scripts/smoke-backend.mjs`
- `docs/OBSIDIAN_VAULT_SETUP.md`
- new docs if useful
- `docs/claude/status/*.md`

**Implementation notes:**

Smoke should test reversible operations using test names under a dedicated smoke prefix and clean up afterward:

```text
_HERMES_UI_SMOKE_PROJECT_DELETE_ME
_HERMES_UI_SMOKE_CANVAS_DELETE_ME
_HERMES_UI_SMOKE_WORKFLOW_DELETE_ME
```

Checks:

- vault status;
- project create/read/archive/cleanup;
- free note create/link/unlink;
- canvas create/update/archive/cleanup;
- workflow create/update/archive/cleanup;
- project Kanban relation if backend supports a reversible route;
- path traversal still rejected;
- cleanup leaves no smoke artifacts behind.

**Verification gate:**

- `npm run smoke` passes or documents pre-existing unrelated backend blockers clearly.
- Build passes.
- No smoke artifacts left in real vault after successful run.
- Docs explain folder structure and usage.

**Commit rule:**

Commit when verified with message:

```text
test: add project workspace smoke coverage
```

---

## CLAUDE-012 — Final browser QA, polish, report, and one final push

**Objective:**

Consolidate the entire Project Workspace feature set and push once.

**Required visual QA:**

- System Overview glass pass.
- Notes free/global notes.
- Notes linked to projects.
- Projects list.
- New Project flow with `+`.
- Project workspace sidebar.
- Project Overview.
- Project Notes/import/link flow.
- Custom canvas create/add/drag/save/reload.
- Workflow create/reorder/link flow.
- Project Kanban create task → main Kanban visibility.
- Project Hermes chat context seed.
- Tag filters.
- Project Intelligence panel.
- Responsive behavior.

**Final checks:**

- `npm run build` passes.
- `npm run smoke` passes, or unrelated backend blockers are documented with exact source.
- Browser console has zero JS errors.
- No committed `.env.local`.
- No committed private note/project/vault data.
- No hardcoded secrets.

**Final report:**

Create a short status artifact:

```text
docs/claude/status/YYYY-MM-DD_project_workspaces_implementation_report.md
```

Include:

- implemented chunks;
- what was verified;
- whether tested against real vault;
- known limitations;
- blockers if any.

**Push rule:**

Push to GitHub only once after finishing the whole file or documenting all blockers.
