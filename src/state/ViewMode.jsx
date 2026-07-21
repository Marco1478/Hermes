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
      enterChat: () => setMode("chat"),
      enterHero: () => setMode("hero"),
      toggle: () => setMode((m) => (m === "hero" ? "chat" : "hero")),
    }),
    [mode]
  );

  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>;
}

export function useViewMode() {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error("useViewMode must be used within ViewModeProvider");
  return ctx;
}
