import { createContext, useContext, useEffect, useMemo, useState } from "react";

const Ctx = createContext(null);

/*
  CommandPaletteMode — global open/close state for the Ctrl/Cmd+K command
  palette (src/components/commands/CommandPalette.jsx), separate from
  ViewMode so any page can trigger it without owning its own keydown
  listener. Named distinctly from the existing chat/CommandPalette.jsx
  (that one is the composer's inline "/" autocomplete, unrelated).
*/
export function CommandPaletteModeProvider({ children }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      const isK = e.key === "k" || e.key === "K";
      if (isK && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo(
    () => ({
      open,
      openPalette: () => setOpen(true),
      closePalette: () => setOpen(false),
      toggle: () => setOpen((v) => !v),
    }),
    [open]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCommandPaletteMode() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCommandPaletteMode must be used within CommandPaletteModeProvider");
  return ctx;
}
