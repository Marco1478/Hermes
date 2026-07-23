# Claude Instructions 009 — Project Operating System, Cross-Linking, Activity, and Workspace Scale Polish

## Context

Marco reviewed the Canvas consolidation after Instructions 008 and confirmed it now works better: the Canvas is finally usable. The next step is not another Canvas-only overhaul. The project system now has the core building blocks:

```text
Projects
Notes
Canvas
Assets
Workflows
Kanban
Project Chat
Project Intelligence
Obsidian vault persistence
```

The next goal is to make these pieces behave like one coherent Project Operating System instead of separate tabs.

Marco also requested one concrete UX requirement:

```text
Increase the size of UI elements inside Project Workspaces a bit, to make them more user friendly.
```

This means larger readable controls, larger cards, better spacing, stronger touch/click targets, and less tiny technical UI inside the project workspace.

## Product North Star

Bad target:

```text
many tabs that work separately
small controls
small cards
weak context
canvas disconnected from notes/tasks/workflows
no activity trail
manual project understanding every time
```

Good target:

```text
one project operating surface
large readable workspace UI
project dashboard with state/next actions
notes/canvas/assets/workflows/kanban linked together
contextual Hermes actions
activity timeline
useful project templates
coherent glass interaction language
```

## Operating Rules

- Work chunks in numeric order unless blocked and a later chunk is independent.
- Verify every chunk before moving to the next.
- Commit locally after each verified chunk.
- Push to GitHub only once after the whole instruction file is complete or blockers are documented.
- Do not commit `.env.local`, secrets, private vault content, uploaded user files, or QA artifacts.
- Do not fake Hermes analysis, backend writes, Obsidian persistence, Kanban status, or project activity.
- If a backend/bridge/API capability is unavailable, show an honest diagnostic and document the blocker.
- Visual UX changes require browser QA. A passing build is not visual proof.
- Preserve prior functionality from Instructions 004–008:
  - Obsidian-backed notes/projects;
  - custom Canvas JSON;
  - real asset upload/library;
  - workflows;
  - per-project Kanban;
  - project chat;
  - project intelligence;
  - smoke checks.

---

## CLAUDE-001 — Audit project workspace coherence and scale before editing

**Objective:**

Inspect the current Project Workspace in the browser and identify where it still feels like small separate widgets instead of one coherent operating surface.

**Files likely involved:**

- no code change required unless creating audit notes
- `src/components/projects/ProjectsPage.jsx`
- `src/components/projects/ProjectsPage.css`
- `src/components/projects/ProjectWorkspace.jsx`
- project workspace panels/components
- `src/components/projects/canvas/ProjectCanvas.jsx`
- `src/components/projects/canvas/ProjectCanvas.css`

**Audit checklist:**

Create/use a disposable project with:

- at least one free note linked/imported;
- at least one canvas with nodes/assets;
- at least one workflow;
- at least one Kanban-linked task;
- at least one uploaded asset.

Inspect:

- workspace overview;
- notes panel;
- canvas panel;
- assets/library if accessible;
- workflows panel;
- Kanban panel;
- chat panel;
- intelligence panel.

Questions:

- Which controls are too small?
- Which cards/rows need larger hit areas?
- Which panels feel disconnected?
- Can you understand project state in 5 seconds?
- Can you move from note -> canvas -> task -> workflow naturally?
- Does Project Workspace feel like a project OS or just a tab container?

**Verification gate:**

- Final report must include a brief list of workspace UX/coherence issues found before implementation.
- Do not make broad edits from assumptions only.

**Commit rule:**

No commit needed for pure audit. If a status artifact is created, commit with:

```text
docs: record project operating system audit
```

---

## CLAUDE-002 — Increase Project Workspace UI scale and ergonomics

**Objective:**

Make Project Workspace controls, cards, and panels larger and easier to use without making the interface bloated.

**Files likely involved:**

- `src/components/projects/ProjectsPage.css`
- `src/components/projects/ProjectWorkspace.jsx`
- `src/components/projects/ProjectWorkspace.css` if present
- project panel CSS files
- `src/components/projects/canvas/ProjectCanvas.css`
- `src/components/ui/glass.css`
- `src/components/PageShell.css`

**Implementation notes:**

Increase user-friendly scale inside Project Workspace:

- larger internal sidebar entries;
- larger panel titles;
- larger action buttons;
- larger card padding;
- bigger empty-state CTAs;
- stronger hover/focus states;
- larger readable metadata chips;
- better spacing between blocks;
- minimum important control height around `42–48px`;
- avoid tiny text below `0.82rem` except dense metadata.

Do not blindly enlarge everything. Preserve density where useful, but remove microscopic/technical UI.

Surfaces to check:

- Overview cards;
- Notes linked/import controls;
- Canvas toolbar/asset cards;
- Workflow step rows;
- Kanban project task cards;
- Chat context/action buttons;
- Intelligence cards.

**Verification gate:**

- Browser QA confirms workspace controls are easier to read/click.
- No clipped labels.
- No new horizontal overflow.
- No bloated wall of giant cards.
- `npm run build` passes.
- Console zero errors.

**Commit rule:**

Commit when verified with:

```text
style: increase project workspace UI scale
```

---

## CLAUDE-003 — Build a real Project Home dashboard

**Objective:**

When opening a project, the Overview/Home should immediately show what the project is, what changed, what is blocked, and what to do next.

**Files likely involved:**

- `src/components/projects/ProjectOverviewPanel.jsx`
- `src/components/projects/ProjectIntelligencePanel.jsx`
- `src/lib/useProjectSignals.js`
- `src/lib/projectContext.js`
- `src/state/Projects.jsx`
- `src/state/Notes.jsx`
- Kanban/workflow helpers

**Project Home should show:**

- Project identity:
  - name;
  - status;
  - color;
  - tags;
  - created/updated.
- Current state:
  - active notes count;
  - canvas count;
  - workflow count;
  - active/blocked Kanban tasks;
  - assets count.
- Latest changes:
  - recently edited notes;
  - recent canvas updates;
  - recent assets/tasks/workflows if available.
- Open blockers:
  - blocked workflow steps;
  - blocked Kanban tasks;
  - missing linked context;
  - vault/bridge issues.
- Suggested next action:
  - deterministic baseline from project state;
  - no fake AI summary unless a model call actually happens.

**Implementation notes:**

- Keep it readable and action-oriented.
- Use glass cards with strong hierarchy.
- Cards should link into the right project section.
- Empty projects should show a clear start path.

**Verification gate:**

- Empty project home looks useful.
- Populated project home summarizes real state.
- Cards navigate to correct sections.
- No fake AI-generated claims.
- Build passes.
- Console zero errors.

**Commit rule:**

Commit when verified with:

```text
feat: add project home dashboard
```

---

## CLAUDE-004 — Add systemic cross-linking between notes, canvas, assets, workflows, and Kanban

**Objective:**

Make project objects aware of each other. The user should move between knowledge, visual planning, execution, and assets without friction.

**Files likely involved:**

- `src/components/projects/ProjectNotesPanel.jsx`
- `src/components/projects/canvas/ProjectCanvas.jsx`
- `src/components/projects/ProjectWorkflows.jsx`
- `src/components/projects/ProjectKanbanPanel.jsx`
- `src/components/projects/ProjectOverviewPanel.jsx`
- `src/state/Projects.jsx`
- `src/state/Notes.jsx`
- `src/lib/projectContext.js`
- `src/lib/useProjectSignals.js`
- `src/lib/obsidianBridge.js`
- `vite-plugins/obsidianBridge.js`

**Required link actions where feasible:**

From note:

- create canvas node from note;
- link note to workflow step;
- link note to Kanban task;
- open linked canvas/task/workflow.

From canvas node:

- link existing note;
- link asset;
- link workflow step;
- link Kanban task;
- open linked item.

From asset:

- create canvas node;
- link to note/canvas/workflow where useful.

From workflow step:

- create/link Kanban task;
- create/link note;
- create/link canvas node.

From Kanban task:

- link to note;
- link to canvas node;
- link to workflow step;
- open project/canvas context.

**Implementation notes:**

- Start with the most useful links if not all can be implemented in one pass.
- Store links in the vault/project metadata/canvas JSON consistently.
- Avoid fragile one-off local UI-only references.
- If a link target was archived/deleted, show clear stale-link UI.
- Do not delete linked objects silently.

**Verification gate:**

- Create a note and create a canvas node from it.
- Link canvas node to a workflow step.
- Link workflow step to a Kanban task.
- Open linked targets from at least two surfaces.
- Reload and verify links persist.
- Archived/stale target handling is graceful.
- Build passes.
- Console zero errors.

**Commit rule:**

Commit when verified with:

```text
feat: add project cross-linking actions
```

---

## CLAUDE-005 — Add contextual Hermes actions inside Project Workspace

**Objective:**

Turn project data into useful Hermes prompts/actions, without pretending to have unavailable backend features.

**Files likely involved:**

- `src/components/projects/ProjectChatPanel.jsx`
- `src/components/projects/ProjectIntelligencePanel.jsx`
- `src/components/projects/ProjectOverviewPanel.jsx`
- `src/lib/projectContext.js`
- `src/lib/useProjectSignals.js`
- `src/state/Chat.jsx`
- `src/lib/hermesBridge.js`

**Actions to add where feasible:**

- `Ask Hermes about this project`
- `Summarize latest notes`
- `Generate next steps`
- `Turn canvas into tasks`
- `Turn workflow into Kanban`
- `Create Claude instruction draft from project context`
- `Find blockers`

**Important:**

If there is no direct backend endpoint for an action, use an honest chat-seeding flow:

```text
Open Chat with a rich prefilled prompt containing project refs and context.
```

Do not show an AI result unless Hermes actually generated it.

**Context payload should include:**

- project overview path;
- note refs/titles;
- canvas refs/nodes summary;
- workflows/blocked steps;
- Kanban linked tasks;
- assets summary;
- tags;
- latest activity if implemented.

**Verification gate:**

- Each visible action either works or clearly explains why unavailable.
- Chat-seeded actions include accurate project context.
- No fake generated content.
- Build passes.
- Console zero errors.

**Commit rule:**

Commit when verified with:

```text
feat: add contextual Hermes project actions
```

---

## CLAUDE-006 — Add Project Activity timeline

**Objective:**

A project should feel alive. Add a real activity timeline from existing project events and metadata.

**Files likely involved:**

- new `src/components/projects/ProjectActivityPanel.jsx`
- `src/components/projects/ProjectWorkspace.jsx`
- `src/state/Projects.jsx`
- `src/state/Notes.jsx`
- `src/lib/obsidianBridge.js`
- `vite-plugins/obsidianBridge.js`
- project metadata helpers

**Events to capture/list where feasible:**

- project created/updated;
- note created/linked/unlinked/archived;
- canvas created/updated;
- asset uploaded;
- workflow created/step updated;
- Kanban task linked/status changed;
- Hermes project action launched;
- Claude instruction draft generated if implemented.

**Implementation notes:**

- Prefer deriving activity from existing metadata where possible.
- If adding an explicit activity log, store it under the project vault folder, for example:

```text
Hermes/Projects/<Project>/activity.json
```

- Keep entries compact and non-sensitive.
- Do not log full file contents, sensitive values, chat transcripts, or private data dumps.
- Show activity as glass timeline rows with icons/chips/timestamps.

**Verification gate:**

- Create/update at least three project objects and see timeline update.
- Reload and verify activity persists if stored explicitly.
- No private file content dumped into activity.
- Build passes.
- Console zero errors.

**Commit rule:**

Commit when verified with:

```text
feat: add project activity timeline
```

---

## CLAUDE-007 — Upgrade project templates into useful starter systems

**Objective:**

Project templates should create useful starter structures, not just empty folders.

**Files likely involved:**

- `src/components/projects/ProjectsPage.jsx`
- `src/state/Projects.jsx`
- template helpers
- `src/lib/obsidianBridge.js`
- `vite-plugins/obsidianBridge.js`

**Templates to support:**

- `Hermes Feature`
- `Web Client Project`
- `AI Video / Ad Campaign`
- `Business Outreach`
- `Learning / Research`
- `Content / Portfolio`
- `Generic`

**Each template should seed, where feasible:**

- `overview.md` with useful sections;
- starter notes;
- starter canvas;
- starter workflow;
- starter Kanban tasks or suggested task list;
- starter tags;
- project color/status.

**Rules:**

- Do not overfill projects with noisy fake data.
- Seed useful scaffolding, not fictional content.
- Template output must be editable and vault-backed.
- If Kanban task creation is unavailable, create a clear suggested task list instead.

**Verification gate:**

- Create at least two template projects.
- Verify folders/files/canvas/workflow are created in vault.
- Verify UI displays seeded objects.
- Verify cleanup of QA projects.
- Build passes.
- Console zero errors.

**Commit rule:**

Commit when verified with:

```text
feat: add richer project templates
```

---

## CLAUDE-008 — Visual coherence pass across Project tabs

**Objective:**

Make Overview, Notes, Canvas, Workflows, Kanban, Chat, Intelligence, and Activity feel like one product.

**Files likely involved:**

- project panel CSS files
- `src/components/projects/ProjectWorkspace.jsx`
- `src/components/projects/ProjectsPage.css`
- `src/components/ui/glass.css`

**Implementation notes:**

- Normalize:
  - panel header layout;
  - action row style;
  - card radii;
  - spacing scale;
  - chip styles;
  - empty states;
  - hover/focus/active states;
  - loading/saving indicators.
- Increase UI scale where still too small.
- Reduce raw text surfaces.
- Ensure every main action has a clear button/card affordance.
- Use teal identity consistently but not aggressively.
- Avoid excessive blur layers that hurt readability/performance.

**Verification gate:**

- Browser QA every project tab.
- UI scale is friendlier than before.
- Tabs feel coherent.
- No major typography/control mismatch.
- Build passes.
- Console zero errors.

**Commit rule:**

Commit when verified with:

```text
style: unify project workspace visual system
```

---

## CLAUDE-009 — Smoke coverage, realistic project QA, report, one final push

**Objective:**

Verify the Project Operating System as a real connected workflow.

**Required checks:**

- `npm run build` passes.
- `npm run smoke` passes, or exact blocker documented.
- Create a disposable realistic project with:
  - template;
  - note;
  - canvas;
  - uploaded asset;
  - workflow;
  - linked Kanban task;
  - contextual Hermes chat/action;
  - activity events.
- Verify cross-links:
  - note -> canvas;
  - canvas -> workflow/task/asset;
  - workflow -> Kanban;
  - project home reflects current state.
- Browser QA:
  - Projects list;
  - Project Home;
  - Notes panel;
  - Canvas panel;
  - Workflows;
  - Kanban;
  - Chat actions;
  - Intelligence;
  - Activity;
  - mobile/narrow layout.
- Browser console zero JS errors.
- Vault checks:
  - files created in expected project folder;
  - no path traversal;
  - no uploaded QA binaries committed;
  - cleanup disposable project/assets/tasks.
- Security scan:
  - no secrets;
  - no `.env.local`;
  - no private vault content;
  - no binary assets in git.

**Final report:**

Create:

```text
docs/claude/status/YYYY-MM-DD_project_operating_system_report.md
```

Keep it short but useful:

- chunks completed;
- project workspace scale changes;
- cross-linking implemented;
- Hermes contextual actions implemented;
- activity/template changes;
- build/smoke/browser QA results;
- remaining limitations/blockers.

**Push rule:**

Push to GitHub only once after all chunks are complete or blockers are documented.
