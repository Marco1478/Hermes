import { createContext, useContext, useMemo, useState } from "react";

const ViewModeContext = createContext(null);

/*
  ViewMode — the single switch between every face of this app: 'hero'
  (idle portrait + command bar), 'chat' (conversation), 'jobs' (cron job
  management), 'hermes' (soul.md, profiles, skills, memory), and 'tools'
  (toolsets + MCP servers). Every layout/morph decision reads from here
  instead of local component state, so Hero, the command bar, the chat
  shell, and the new pages all agree on which world they're in.
*/
export function ViewModeProvider({ children }) {
  const [mode, setMode] = useState("hero");
  // Set by a project's "open Main Kanban filtered to this project" link
  // (ProjectKanbanPanel) and consumed once by KanbanPage on arrival — same
  // one-shot handoff pattern as ProjectWorkspace's pendingCanvasId, just
  // crossing the top-level mode boundary instead of a project-internal tab.
  const [kanbanFilterProjectId, setKanbanFilterProjectId] = useState(null);

  const value = useMemo(
    () => ({
      mode,
      isHero: mode === "hero",
      isChat: mode === "chat",
      isJobs: mode === "jobs",
      isHermes: mode === "hermes",
      isTools: mode === "tools",
      isSystem: mode === "system",
      isKanban: mode === "kanban",
      goTo: (m) => setMode(m),
      goToKanban: (projectId) => {
        setKanbanFilterProjectId(projectId);
        setMode("kanban");
      },
      kanbanFilterProjectId,
      consumeKanbanFilter: () => setKanbanFilterProjectId(null),
      enterChat: () => setMode("chat"),
      enterHero: () => setMode("hero"),
      toggle: () => setMode((m) => (m === "hero" ? "chat" : "hero")),
    }),
    [mode, kanbanFilterProjectId]
  );

  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>;
}

export function useViewMode() {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error("useViewMode must be used within ViewModeProvider");
  return ctx;
}
