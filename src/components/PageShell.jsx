import { useEffect } from "react";
import { useViewMode } from "../state/ViewMode.jsx";
import { BrandMark } from "./BrandMark.jsx";
import { PageNav } from "./PageNav.jsx";
import "./PageShell.css";

/*
  PageShell — the shared shell for every non-hero, non-chat page (Jobs,
  Hermes, Tools, System). Same header language as ChatContainer (BrandMark,
  centered tab nav) so the app reads as one system instead of bolted-on
  screens. No visible "esc" pill — Escape still goes home from the keyboard.
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
        <div className="page-header-extra">{headerExtra}</div>
      </header>
      <div className="page-scroll">
        <div className="page-constrain">{children}</div>
      </div>
    </div>
  );
}
