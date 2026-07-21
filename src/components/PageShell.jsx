import { useEffect } from "react";
import { useViewMode } from "../state/ViewMode.jsx";
import { BrandMark } from "./BrandMark.jsx";
import { PageNav } from "./PageNav.jsx";
import "./PageShell.css";

/*
  PageShell — the shared shell for every non-hero, non-chat page (Jobs,
  Hermes, Tools). Same header language as ChatContainer (BrandMark, tab
  nav, esc-to-hero) so the app reads as one system instead of bolted-on
  screens.
*/
export function PageShell({ title, headerExtra, children }) {
  const { enterHero } = useViewMode();

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") enterHero();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enterHero]);

  return (
    <div className="page-shell">
      <BrandMark />
      <header className="page-header">
        <h1 className="page-title mono">{title}</h1>
        <PageNav />
        {headerExtra && <div className="page-header-extra">{headerExtra}</div>}
        <button type="button" className="page-back mono" onClick={enterHero}>
          esc
        </button>
      </header>
      <div className="page-scroll">
        <div className="page-constrain">{children}</div>
      </div>
    </div>
  );
}
