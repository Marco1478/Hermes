# Claude Instructions 010 — General Kanban, Project Kanban Mirroring, Cozy Project Home, and Claude Code Activity

## Context

Marco approved the next structural step for the Hermes custom UI. The current project system has Projects, Notes, Canvas, Assets, Workflows, Project Chat, Project Intelligence, Activity, and Obsidian-backed persistence. Canvas is now usable after the latest consolidation. The next goal is to make Kanban/project/home/activity behavior more coherent and operational.

Marco's confirmed decisions:

- The Main Kanban must be able to exist independently from Projects.
- There should be many separate Kanbans, one per project.
- Project Kanbans should automatically mirror/feed into the Main Kanban.
- Each project task in the Main Kanban should be clearly distinguished by project tag/color/chip.
- General tasks with no project must still exist in the Main Kanban as Inbox/General tasks.
- Project Home should be a bit more cozy while preserving important information.
- Project Home should sit above the section list in the project navigation/sidebar, not feel buried as just another tab.
- Activity should show important operational events, not every micro-edit.
- Activity should show when Claude Code is activated, completes, blocks, or pushes.

## Product North Star

Bad target:

```text
Main Kanban only as project aggregation
Project Kanbans detached from main board
manual duplicated task copies
tiny cold project home
no clear project color/tag language
activity full of noisy autosave/micro-edit events
Claude Code running invisibly
```

Good target:

```text
Main Kanban = standalone General board + automatic Project aggregation
Project Kanban = focused board for one project
one task identity across all views
project color/tag visible everywhere
cozy but useful project home
important-only activity timeline
Claude Code lifecycle visible as real operational events
```

## Operating Rules

- Work chunks in numeric order unless blocked and a later chunk is independent.
- Verify every chunk before moving to the next.
- Commit locally after each verified chunk.
- Push to GitHub only once after the whole instruction file is complete or blockers are documented.
- Do not commit `.env.local`, credentials, tokens, private vault content, uploaded user files, generated QA artifacts, or disposable test data.
- Do not fake Kanban mirroring, project persistence, Claude Code events, activity logs, or backend writes.
- If a backend/bridge/API capability is unavailable, show an honest diagnostic and document the blocker.
- Visual UX changes require browser QA. A passing build is not proof.
- Preserve prior functionality from Instructions 004–009:
  - Obsidian-backed Notes/Projects;
  - custom Canvas JSON;
  - real asset upload/library;
  - workflows;
  - project cross-linking;
  - project activity;
  - project home;
  - project chat/intelligence;
  - smoke checks.

---

## CLAUDE-001 — Audit current Kanban/project task model and activity flows

**Objective:**

Before editing, understand current Kanban state, project task linking, and Activity logging so the new model does not introduce duplicate task identities or fake mirrors.

**Files likely involved:**

- `src/components/kanban/KanbanPage.jsx`
- `src/components/kanban/KanbanCard.jsx`
- `src/components/kanban/KanbanColumn.jsx`
- `src/components/kanban/KanbanPage.css`
- `src/components/projects/ProjectKanbanPanel.jsx`
- `src/components/projects/ProjectOverviewPanel.jsx`
- `src/components/projects/ProjectWorkspace.jsx`
- `src/components/projects/ProjectActivityPanel.jsx`
- `src/state/Projects.jsx`
- `src/lib/kanbanBridge.js`
- `src/lib/useProjectSignals.js`
- `src/lib/projectContext.js`
- `vite-plugins/kanbanBridge.js`
- `vite-plugins/hermesBridge.js`

**Audit checklist:**

- Identify how a task is represented in the Main Kanban today.
- Identify how a task is linked to a project today.
- Identify whether project task links are stored on task metadata, project metadata, a relation file, or local UI state.
- Identify how project Kanban panel filters tasks today.
- Identify whether Main Kanban currently shows project-linked tasks and how.
- Identify current behavior for tasks with no project.
- Identify where Activity events are appended today.
- Identify whether there is already any Claude Code runner/activity hook.

**Verification gate:**

- Final report includes a concise audit summary.
- No code commit required unless adding audit status file.

**Commit rule:**

If creating an audit artifact, commit with:

```text
docs: record Kanban and Claude activity audit
```

---

## CLAUDE-002 — Define stable Kanban task ownership and project metadata model

**Objective:**

Make Main Kanban and Project Kanbans share one task identity model.

**Files likely involved:**

- `src/lib/kanbanBridge.js`
- `vite-plugins/kanbanBridge.js`
- `src/state/Projects.jsx`
- `src/lib/useProjectSignals.js`
- project metadata helpers
- smoke script if applicable

**Required model:**

A task can be either:

```text
General / Inbox task
projectId: null
```

or:

```text
Project task
projectId: <project id/slug>
projectName: <display name>
projectColor: <project color>
projectTag: <project tag/slug>
```

Rules:

- Main Kanban is not only a project aggregation. It must also contain General/Inbox tasks with no project.
- Project Kanban shows only tasks belonging to that project.
- Main Kanban shows General tasks + all project tasks.
- Moving/changing a task status in Main Kanban must update the same task that appears in the Project Kanban.
- Moving/changing a task status in Project Kanban must update the same task visible in Main Kanban.
- Do not create two separate copies of a task unless backend constraints force it; if forced, document the blocker and show honest diagnostics.

**Project metadata requirement:**

Ensure each project has stable:

```text
id/slug
name
color
tag
status
```

Use this metadata for Kanban chips, filters, project home, and activity.

**Verification gate:**

- Create General task: appears in Main Kanban only.
- Create Project task: appears in Project Kanban and Main Kanban.
- Same task id/reference is used across both views where backend permits.
- Project metadata exists and is persisted.
- Build passes.
- Console zero errors.

**Commit rule:**

Commit when verified with:

```text
feat: define Kanban task project ownership model
```

---

## CLAUDE-003 — Implement per-project Kanban boards as focused views

**Objective:**

Each project should have its own Kanban board that feels separate and focused, while still feeding the Main Kanban automatically.

**Files likely involved:**

- `src/components/projects/ProjectKanbanPanel.jsx`
- `src/components/projects/ProjectWorkspace.jsx`
- `src/components/kanban/KanbanCard.jsx`
- `src/components/kanban/KanbanColumn.jsx`
- `src/components/kanban/KanbanPage.css`
- `src/lib/kanbanBridge.js`
- `src/lib/useProjectSignals.js`

**Implementation notes:**

Project Kanban should:

- show only tasks for the current project;
- create new tasks already assigned to the current project;
- use the project color/tag in board header and cards;
- show empty state specific to this project;
- support the same status transitions as Main Kanban where backend permits;
- explain unsupported status transitions honestly;
- link back/open in Main Kanban filtered to this project.

**Verification gate:**

- Create two projects.
- Create a task in each Project Kanban.
- Each project board only shows its own task.
- Both tasks appear in Main Kanban with distinct project chips/colors.
- Updating a project task status is reflected in Main Kanban.
- Build passes.
- Console zero errors.

**Commit rule:**

Commit when verified with:

```text
feat: add focused per-project Kanban boards
```

---

## CLAUDE-004 — Upgrade Main Kanban into General board + project aggregation

**Objective:**

Main Kanban should be the global operational board: General/Inbox tasks plus automatic project task aggregation.

**Files likely involved:**

- `src/components/kanban/KanbanPage.jsx`
- `src/components/kanban/KanbanCard.jsx`
- `src/components/kanban/KanbanColumn.jsx`
- `src/components/kanban/KanbanPage.css`
- `src/lib/kanbanBridge.js`
- `src/lib/useProjectSignals.js`

**Implementation notes:**

Main Kanban must support:

- creating a General/Inbox task with no project;
- assigning/reassigning a task to a project where feasible;
- removing project assignment and returning task to General/Inbox where feasible;
- filtering by project/tag/status/blocker/owner where feasible;
- showing General tasks with a neutral `General` or `Inbox` chip;
- showing project tasks with project chip/color/tag;
- opening a project from a project task card;
- opening Project Kanban filtered/focused from a project task.

Suggested filters:

```text
All
General / Inbox
Project
Tag
Blocked
Assigned to Hermes
Assigned to Claude
Recently updated
```

If backend does not support owner/updated filters yet, implement only real filters and document missing ones as limitations.

**Verification gate:**

- Create General task from Main Kanban.
- Create Project task from Project Kanban.
- Main Kanban shows both correctly.
- Filter General shows only non-project tasks.
- Filter by project shows only that project.
- Project chips/colors render clearly.
- No duplicate phantom tasks.
- Build passes.
- Console zero errors.

**Commit rule:**

Commit when verified with:

```text
feat: aggregate project tasks in main Kanban
```

---

## CLAUDE-005 — Cozy but useful Project Home above project navigation/list

**Objective:**

Make Project Home feel more welcoming/cozy while preserving important operational information, and place it above the project section list/navigation so it becomes the natural landing area.

**Files likely involved:**

- `src/components/projects/ProjectWorkspace.jsx`
- `src/components/projects/ProjectOverviewPanel.jsx`
- `src/components/projects/ProjectsPage.css`
- `src/components/projects/ProjectActivityPanel.jsx`
- project sidebar/nav components if separate

**Implementation notes:**

Project Home should be:

- visually warmer/cozier than a cold metrics cockpit;
- still information-dense enough to be useful;
- the first visible context when opening a project;
- placed above or integrated before the section list in the project sidebar/nav area;
- not buried as just another tab label.

Content should include:

- project name/status/color/tag;
- short description;
- `Today / Next` area;
- important tasks/blockers;
- latest meaningful activity;
- primary actions:
  - Ask Hermes;
  - Open Project Kanban;
  - Create Note;
  - Create Canvas;
  - Start Claude Code / Draft Instructions if implemented.

Cozy aesthetic suggestions:

- softer glass panel behind Home summary;
- subtle project color gradient/glow;
- larger readable cards;
- more human empty states;
- fewer tiny raw metric tiles;
- no exaggerated cyberpunk clutter.

**Verification gate:**

- Opening a project makes Home/context visible before the section list dominates.
- Home feels warmer but still practical.
- Important info remains visible.
- Project section navigation remains usable.
- Desktop/tablet/mobile QA passes.
- Build passes.
- Console zero errors.

**Commit rule:**

Commit when verified with:

```text
style: make project home cozier and more prominent
```

---

## CLAUDE-006 — Filter Activity to important operational events

**Objective:**

Activity timeline should show meaningful project operations, not every micro-edit/autosave.

**Files likely involved:**

- `src/components/projects/ProjectActivityPanel.jsx`
- `src/state/Projects.jsx`
- `src/lib/obsidianBridge.js`
- `vite-plugins/hermesBridge.js`
- places where `logProjectActivity` is called

**Important events to keep/show:**

- Project created;
- Project status changed;
- Important note linked/imported/archived;
- Canvas created;
- Major asset uploaded;
- Workflow created;
- Important workflow step completed/blocked;
- Kanban task created/completed/blocked;
- Claude instruction draft generated;
- Hermes project review generated/launched;
- Claude Code started;
- Claude Code completed;
- Claude Code blocked/failed;
- Claude Code pushed commit;
- Hermes review completed.

**Events to avoid/noise-filter:**

- every autosave;
- every drag/resize;
- every minor text edit;
- every transient hover/selection;
- every internal smoke/QA artifact;
- every repeated save-state heartbeat.

**Implementation notes:**

- Add event severity/type if useful:

```text
milestone
action
blocker
automation
review
asset
kanban
```

- Add filters or grouping if the timeline grows:
  - All important;
  - Automation;
  - Blockers;
  - Kanban;
  - Assets;
  - Reviews.
- Keep activity compact and readable.

**Verification gate:**

- Trigger several major events and see them.
- Trigger minor edits/autosaves and confirm they do not spam timeline.
- Activity persists in vault.
- Build passes.
- Console zero errors.

**Commit rule:**

Commit when verified with:

```text
fix: keep project activity focused on important events
```

---

## CLAUDE-007 — Add Claude Code lifecycle events to Project Activity

**Objective:**

Now that Claude Code can run on the Hermes server/container, the UI should show when it is activated and what happened.

**Files likely involved:**

- `src/components/projects/ProjectActivityPanel.jsx`
- `src/components/projects/ProjectChatPanel.jsx`
- `src/components/projects/ProjectOverviewPanel.jsx`
- `src/lib/projectContext.js`
- `src/lib/obsidianBridge.js`
- `vite-plugins/hermesBridge.js`
- `scripts` if any Claude runner wrapper exists or is added later
- docs/status report

**Important constraint:**

Do not assume a full Claude Code runner UI exists if it does not. If there is no backend route yet to launch Claude Code from the UI, implement honest activity/event support and diagnostic copy, or add a minimal safe bridge only if it can be verified.

**Events to represent:**

```text
Claude Code launched
Instruction file used
Project context attached
Repo/branch
Start timestamp
End timestamp
Exit status
Commit pushed
Report path
Blocked/failed reason
```

**Preferred safe behavior:**

- If a Claude Code wrapper already exists, log lifecycle events from it.
- If only Hermes/terminal can launch Claude Code for now, provide UI labels/placeholders that explain the runner is server-side and log events when the backend records them.
- Do not put a fake `Start Claude Code` button that does nothing or pretends to launch.
- If adding a minimal launch bridge, require:
  - explicit project/instruction selection;
  - no secrets printed;
  - no arbitrary shell command input;
  - status persisted to project activity;
  - clear running/completed/failed state.

**Verification gate:**

- Activity can display Claude Code lifecycle event records.
- If launch bridge is implemented, test with a harmless read-only Claude task or a diagnostic no-op.
- UI does not fake successful Claude execution.
- Build passes.
- Smoke passes or blocker documented.
- Console zero errors.

**Commit rule:**

Commit when verified with:

```text
feat: show Claude Code lifecycle in project activity
```

---

## CLAUDE-008 — Visual polish for Kanban/Home/Activity integration

**Objective:**

Make the new Kanban/Home/Activity changes feel coherent and premium.

**Files likely involved:**

- `src/components/kanban/KanbanPage.css`
- `src/components/kanban/KanbanCard.jsx`
- `src/components/projects/ProjectKanbanPanel.jsx`
- `src/components/projects/ProjectOverviewPanel.jsx`
- `src/components/projects/ProjectActivityPanel.jsx`
- `src/components/projects/ProjectsPage.css`
- shared glass styles

**Implementation notes:**

- Project chips should look premium and readable.
- General/Inbox chip should be visually distinct but neutral.
- Project Home should use project color tastefully.
- Activity automation events should be easy to scan.
- Kanban cards should show source/project without clutter.
- Controls should remain comfortably sized.
- Avoid turning Main Kanban into a noisy color carnival.

**Verification gate:**

- Browser QA Main Kanban with mixed General + multiple Project tasks.
- Browser QA Project Kanban.
- Browser QA Project Home.
- Browser QA Activity with Claude/automation events.
- Mobile/narrow layout has no horizontal overflow.
- Build passes.
- Console zero errors.

**Commit rule:**

Commit when verified with:

```text
style: polish Kanban and project activity integration
```

---

## CLAUDE-009 — Smoke coverage, realistic QA, final report, one final push

**Objective:**

Verify the new Kanban/project/activity system with a realistic disposable setup.

**Required checks:**

- `npm run build` passes.
- `npm run smoke` passes, or exact blocker documented.
- Create disposable projects:
  - Project A with color/tag;
  - Project B with color/tag.
- Create:
  - General task in Main Kanban;
  - Project A task in Project Kanban;
  - Project B task in Project Kanban.
- Verify:
  - Main Kanban shows all three;
  - General task has General/Inbox chip;
  - Project tasks have distinct project chips/colors;
  - filtering by project works;
  - Project A board shows only Project A task;
  - Project B board shows only Project B task;
  - status change reflects across views where backend permits.
- Verify cozy Project Home:
  - above/near project section list;
  - important info visible;
  - not cold/raw metrics only.
- Verify Activity:
  - important events appear;
  - micro-edits/autosaves do not spam;
  - Claude Code lifecycle events display if implemented/recorded.
- Browser console zero JS errors.
- Vault checks:
  - expected metadata/activity files written;
  - cleanup disposable projects/tasks/assets.
- Security scan:
  - no secrets;
  - no `.env.local`;
  - no private vault content;
  - no uploaded binaries in git.

**Final report:**

Create:

```text
docs/claude/status/YYYY-MM-DD_general_project_kanban_activity_report.md
```

Include briefly:

- Main Kanban general + aggregation model;
- Project Kanban behavior;
- cozy Home changes;
- Activity filtering;
- Claude Code lifecycle support status;
- build/smoke/browser QA;
- blockers/limitations.

**Push rule:**

Push to GitHub only once after all chunks are complete or blockers are documented.
