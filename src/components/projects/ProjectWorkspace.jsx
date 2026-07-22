import { useState } from "react";
import { ProjectOverviewPanel } from "./ProjectOverviewPanel.jsx";
import { ProjectNotesPanel } from "./ProjectNotesPanel.jsx";
import { ProjectCanvas } from "./canvas/ProjectCanvas.jsx";
import { ProjectWorkflows } from "./workflows/ProjectWorkflows.jsx";
import { ProjectChatPanel } from "./ProjectChatPanel.jsx";
import { ProjectTagExplorer } from "./ProjectTagExplorer.jsx";
import { WorkspacePlaceholder } from "./WorkspacePlaceholder.jsx";

const SECTIONS = [
  { key: "overview", label: "Overview" },
  { key: "notes", label: "Notes" },
  { key: "canvas", label: "Canvas" },
  { key: "workflows", label: "Workflows" },
  { key: "kanban", label: "Kanban" },
  { key: "chat", label: "Chat" },
  { key: "intelligence", label: "Intelligence" },
];

/*
  ProjectWorkspace — a project is a self-contained operational space, not
  just a card: its own internal sidebar switches between Overview, Notes,
  Canvas, Workflows, Kanban, Chat, and Intelligence, all scoped to this one
  project. Lives inside the Projects tab (no new top-level route) — "back"
  just returns ProjectsPage to its list view.
*/
export function ProjectWorkspace({ project, notes, vaultStatus, onBack, onUpdate, onDelete, onToggleArchive, milestoneActions, noteActions }) {
  const [section, setSection] = useState("overview");
  const [activeTag, setActiveTag] = useState(null);

  return (
    <div className="project-workspace">
      <aside className="project-workspace-nav">
        <button type="button" className="project-workspace-back" onClick={onBack}>
          ← projects
        </button>
        <div className="project-workspace-heading">
          {project.color && <span className={`note-color-dot note-color-dot--${project.color}`} />}
          <span className="project-workspace-name">{project.name || "Untitled project"}</span>
        </div>
        <nav className="project-workspace-tabs">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`project-workspace-tab${section === s.key ? " project-workspace-tab--active" : ""}`}
              onClick={() => setSection(s.key)}
            >
              {s.label}
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
        {section === "kanban" && (
          <WorkspacePlaceholder title="Kanban" chunk="CLAUDE-008" detail="Project-scoped Kanban view (mirroring the main board) lands in a later chunk." />
        )}
        {section === "chat" && <ProjectChatPanel project={project} notes={notes} />}
        {section === "intelligence" && (
          <WorkspacePlaceholder title="Intelligence" chunk="CLAUDE-009" detail="A deterministic project summary panel lands in a later chunk." />
        )}
      </div>
    </div>
  );
}
