import { useViewMode } from "../state/ViewMode.jsx";
import "./PageNav.css";

const TABS = [
  { id: "chat", label: "chat" },
  { id: "hermes", label: "hermes" },
  { id: "jobs", label: "jobs" },
  { id: "tools", label: "tools" },
  { id: "kanban", label: "kanban" },
  { id: "safety", label: "safety" },
  { id: "system", label: "system" },
];

/*
  PageNav — the tab strip shared by every non-hero page (chat, hermes,
  jobs, tools, system). BrandMark stays the way back to the hero (or, from
  the hero itself, the way into System Overview); this is purely lateral
  movement between the working pages.
*/
export function PageNav() {
  const { mode, goTo } = useViewMode();

  return (
    <nav className="page-nav mono" aria-label="Sections">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`page-nav-tab${mode === t.id ? " page-nav-tab--active" : ""}`}
          onClick={() => goTo(t.id)}
          aria-current={mode === t.id ? "page" : undefined}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
