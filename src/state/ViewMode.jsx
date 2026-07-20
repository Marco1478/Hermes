import { createContext, useContext, useMemo, useState } from "react";

const ViewModeContext = createContext(null);

/*
  ViewMode — the single switch between the two faces of this app:
  'hero' (idle portrait + command bar) and 'chat' (conversation). Every
  layout/morph decision reads from here instead of local component state,
  so the Hero, the command bar, and the chat shell all agree on which
  world they're in.
*/
export function ViewModeProvider({ children }) {
  const [mode, setMode] = useState("hero");

  const value = useMemo(
    () => ({
      mode,
      isHero: mode === "hero",
      isChat: mode === "chat",
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
