import { useState } from "react";
import { ProjectOverviewPanel } from "./ProjectOverviewPanel.jsx";
import { ProjectNotesPanel } from "./ProjectNotesPanel.jsx";
import { ProjectCanvas } from "./canvas/ProjectCanvas.jsx";
import { ProjectWorkflows } from "./workflows/ProjectWorkflows.jsx";
import { ProjectKanbanPanel } from "./ProjectKanbanPanel.jsx";
import { ProjectChatPanel } from "./ProjectChatPanel.jsx";
import { ProjectIntelligencePanel } from "./ProjectIntelligencePanel.jsx";
import { ProjectTagExplorer } from "./ProjectTagExplorer.jsx";

const SECTIONS = [
  { key: "overview", label: "Overview" },
  { key: "notes", label: "Notes" },
  { key: "canvas", label: "Canvas" },
  { key: "workflows", label: "Workflows" },
  { key: "kanban", label: "Kanban" },
  { key: "chat", label: "Chat" },
  { key: "intelligence", label: "Intelligence" },
];

const NAV_COLLAPSE_KEY = "hermes-ui.project-nav-collapsed.v1";

function loadNavCollapsed() {
  try {
    return localStorage.getItem(NAV_COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

/*
  ProjectWorkspace — a project is a self-contained operational space, not
  just a card: its own internal sidebar switches between Overview, Notes,
  Canvas, Workflows, Kanban, Chat, and Intelligence, all scoped to this one
  project. Lives inside the Projects tab (no new top-level route) — "back"
  just returns ProjectsPage to its list view.

  The nav is collapsible (own localStorage flag, same pattern as the
  global rail's — see state/RailCollapse.jsx) because Canvas specifically
  needs every pixel of width it can get: the fixed 200-240px sidebar plus
  the global rail plus the canvas inspector were together crushing the
  board down to a sliver at ordinary window widths (see CLAUDE-002 audit).
*/
export function ProjectWorkspace({ project, notes, vaultStatus, onBack, onUpdate, onDelete, onToggleArchive, milestoneActions, noteActions, taskActions }) {
  const [section, setSection] = useState("overview");
  const [activeTag, setActiveTag] = useState(null);
  const [navCollapsed, setNavCollapsed] = useState(loadNavCollapsed);

  const toggleNav = () => {
    setNavCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(NAV_COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* best effort */
      }
      return next;
    });
  };

  return (
    <div className={`project-workspace${navCollapsed ? " project-workspace--nav-collapsed" : ""}`}>
      <aside className="project-workspace-nav">
        <div className="project-workspace-nav-head">
          <button type="button" className="project-workspace-back" onClick={onBack} title="Back to projects">
            {navCollapsed ? "←" : "← projects"}
          </button>
          <button
            type="button"
            className="project-workspace-nav-toggle"
            onClick={toggleNav}
            title={navCollapsed ? "Expand project sidebar" : "Collapse project sidebar"}
            aria-label={navCollapsed ? "Expand project sidebar" : "Collapse project sidebar"}
          >
            {navCollapsed ? "»" : "«"}
          </button>
        </div>
        <div className="project-workspace-heading">
          {project.color && <span className={`note-color-dot note-color-dot--${project.color}`} />}
          {!navCollapsed && <span className="project-workspace-name">{project.name || "Untitled project"}</span>}
        </div>
        <nav className="project-workspace-tabs">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`project-workspace-tab${section === s.key ? " project-workspace-tab--active" : ""}`}
              onClick={() => setSection(s.key)}
              title={navCollapsed ? s.label : undefined}
            >
              {navCollapsed ? s.label.slice(0, 2).toUpperCase() : s.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="project-workspace-content">
        <ProjectTagExplorer project={project} notes={notes} activeTag={activeTag} onSelectTag={setActiveTag} />
        {section === "overview" && (
          <ProjectOverviewPanel
            project={project}
            vaultStatus={vaultStatus}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onToggleArchive={onToggleArchive}
            onAddMilestone={milestoneActions.add}
            onToggleMilestone={milestoneActions.toggle}
            onRemoveMilestone={milestoneActions.remove}
          />
        )}
        {section === "notes" && (
          <ProjectNotesPanel project={project} notes={notes} onLinkNote={noteActions.link} onUnlinkNote={noteActions.unlink} onCreateNote={noteActions.create} tagFilter={activeTag} />
        )}
        {section === "canvas" && <ProjectCanvas project={project} tagFilter={activeTag} />}
        {section === "workflows" && <ProjectWorkflows project={project} tagFilter={activeTag} />}
        {section === "kanban" && <ProjectKanbanPanel project={project} onLinkTask={taskActions.link} onUnlinkTask={taskActions.unlink} />}
        {section === "chat" && <ProjectChatPanel project={project} notes={notes} />}
        {section === "intelligence" && <ProjectIntelligencePanel project={project} notes={notes} onOpenChat={() => setSection("chat")} />}
      </div>
    </div>
  );
}
