import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/*
  Projects — local-first, same reasoning as state/Notes.jsx: there is no
  `hermes projects` backend anywhere (only Kanban has a real CLI-backed
  board). This is Marco's own planning layer *on top of* notes, kept
  honestly local rather than faking a bridge that doesn't exist.
*/

const ProjectsContext = createContext(null);
const STORE_KEY = "hermes-ui.projects.v1";

export const STATUSES = ["planning", "active", "on_hold", "done", "archived"];
export const PRIORITIES = ["low", "medium", "high"];

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyProject(overrides = {}) {
  const now = Date.now();
  return {
    id: uid(),
    name: "",
    description: "",
    status: "planning",
    priority: "medium",
    color: null,
    tags: [],
    dueDate: null,
    milestones: [],
    linkedNoteIds: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function loadProjects() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(data)) return [];
    return data.map((p) => ({ ...emptyProject(), ...p }));
  } catch {
    return [];
  }
}

export function ProjectsProvider({ children }) {
  const [projects, setProjects] = useState(loadProjects);

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(projects));
      } catch {
        /* quota — best effort */
      }
    }, 300);
    return () => clearTimeout(id);
  }, [projects]);

  const createProject = useCallback((overrides) => {
    const project = emptyProject(overrides);
    setProjects((prev) => [project, ...prev]);
    return project.id;
  }, []);

  const updateProject = useCallback((id, patch) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...(typeof patch === "function" ? patch(p) : patch), updatedAt: Date.now() } : p))
    );
  }, []);

  const deleteProject = useCallback((id) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // ---- Milestones ------------------------------------------------------------
  const addMilestone = useCallback((projectId, text) => {
    const item = { id: uid(), text, done: false };
    updateProject(projectId, (p) => ({ milestones: [...p.milestones, item] }));
  }, [updateProject]);

  const toggleMilestone = useCallback((projectId, itemId) => {
    updateProject(projectId, (p) => ({ milestones: p.milestones.map((m) => (m.id === itemId ? { ...m, done: !m.done } : m)) }));
  }, [updateProject]);

  const removeMilestone = useCallback((projectId, itemId) => {
    updateProject(projectId, (p) => ({ milestones: p.milestones.filter((m) => m.id !== itemId) }));
  }, [updateProject]);

  // ---- Note linking ------------------------------------------------------------
  const linkNote = useCallback((projectId, noteId) => {
    updateProject(projectId, (p) => (p.linkedNoteIds.includes(noteId) ? p : { linkedNoteIds: [...p.linkedNoteIds, noteId] }));
  }, [updateProject]);

  const unlinkNote = useCallback((projectId, noteId) => {
    updateProject(projectId, (p) => ({ linkedNoteIds: p.linkedNoteIds.filter((id) => id !== noteId) }));
  }, [updateProject]);

  const allTags = useMemo(() => {
    const set = new Set();
    for (const p of projects) for (const t of p.tags || []) set.add(t);
    return [...set].sort();
  }, [projects]);

  const value = useMemo(
    () => ({
      projects,
      allTags,
      createProject,
      updateProject,
      deleteProject,
      addMilestone,
      toggleMilestone,
      removeMilestone,
      linkNote,
      unlinkNote,
    }),
    [projects, allTags, createProject, updateProject, deleteProject, addMilestone, toggleMilestone, removeMilestone, linkNote, unlinkNote]
  );

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be used within ProjectsProvider");
  return ctx;
}
