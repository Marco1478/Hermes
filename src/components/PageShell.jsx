import { useEffect } from "react";
import { useViewMode } from "../state/ViewMode.jsx";
import { useCommandPaletteMode } from "../state/CommandPaletteMode.jsx";
import { useRailCollapse } from "../state/RailCollapse.jsx";
import { BrandMark } from "./BrandMark.jsx";
import { PageNav } from "./PageNav.jsx";
import "./PageShell.css";

/*
  PageShell — the shared shell for every non-hero, non-chat page (Jobs,
  Hermes, Tools, System). Same header language as ChatContainer (BrandMark,
  centered tab nav) so the app reads as one system instead of bolted-on
  screens. No visible "esc" pill — Escape still goes home from the keyboard.
  The rail collapse toggle only renders/matters at the desktop breakpoint
  (see PageShell.css's min-width:861px rail rules) — collapsing is a no-op
  visually below that width, where the nav is already a compact scrolling
  strip, not a rail.
*/
export function PageShell({ title, headerExtra, children, wide = false, edge = false }) {
  const { enterHero } = useViewMode();
  const { openPalette } = useCommandPaletteMode();
  const { collapsed, toggle } = useRailCollapse();

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") enterHero();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enterHero]);

  return (
    <div className={`page-shell${collapsed ? " page-shell--rail-collapsed" : ""}`}>
      <BrandMark />
      <header className="page-header">
        <h1 className="page-title mono">{title}</h1>
        <button
          type="button"
          className="page-rail-toggle"
          onClick={toggle}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {collapsed ? "»" : "«"}
        </button>
        <PageNav />
        <div className="page-header-extra">
          {headerExtra}
          <button type="button" className="btn-pill" title="Command palette (Ctrl/Cmd+K)" onClick={openPalette}>
            ⌘K
          </button>
        </div>
      </header>
      <div className="page-scroll">
        <div className={`page-constrain${wide ? " page-constrain--wide" : ""}${edge ? " page-constrain--edge" : ""}`}>{children}</div>
      </div>
    </div>
  );
}
