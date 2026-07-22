import { createContext, useContext, useEffect, useMemo, useState } from "react";

const RailCollapseContext = createContext(null);
const STORE_KEY = "hermes-ui.rail-collapsed.v1";

/*
  RailCollapse — whether the global left command rail (PageShell's nav
  column) is expanded or shows compact single-letter entries. Purely a
  local UI preference (not backend-shaped data), same reasoning as
  KanbanPage's column-order localStorage — honest to persist locally.
*/
export function RailCollapseProvider({ children }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, collapsed ? "1" : "0");
    } catch {
      /* best effort */
    }
  }, [collapsed]);

  const value = useMemo(() => ({ collapsed, toggle: () => setCollapsed((c) => !c) }), [collapsed]);

  return <RailCollapseContext.Provider value={value}>{children}</RailCollapseContext.Provider>;
}

export function useRailCollapse() {
  const ctx = useContext(RailCollapseContext);
  if (!ctx) throw new Error("useRailCollapse must be used within RailCollapseProvider");
  return ctx;
}
