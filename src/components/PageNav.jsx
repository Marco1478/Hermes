import { useViewMode } from "../state/ViewMode.jsx";
import { useRailCollapse } from "../state/RailCollapse.jsx";
import "./PageNav.css";

const TABS = [
  { id: "chat", label: "chat" },
  { id: "hermes", label: "hermes" },
  { id: "jobs", label: "jobs" },
  { id: "tools", label: "tools" },
  { id: "kanban", label: "kanban" },
  { id: "notes", label: "notes" },
  { id: "projects", label: "projects" },
  { id: "missions", label: "missions" },
  { id: "safety", label: "safety" },
  { id: "system", label: "system" },
];

/*
  PageNav — the tab strip shared by every non-hero page (chat, hermes,
  jobs, tools, system). BrandMark stays the way back to the hero (or, from
  the hero itself, the way into System Overview); this is purely lateral
  movement between the working pages. `collapsed` (desktop rail only —
  see PageShell's collapse toggle) swaps full labels for a single-letter
  chip with the full name as a tooltip, rather than picking an icon set.
*/
export function PageNav() {
  const { mode, goTo } = useViewMode();
  const { collapsed } = useRailCollapse();

  return (
    <nav className={`page-nav mono${collapsed ? " page-nav--collapsed" : ""}`} aria-label="Sections">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`page-nav-tab${mode === t.id ? " page-nav-tab--active" : ""}`}
          onClick={() => goTo(t.id)}
          aria-current={mode === t.id ? "page" : undefined}
          title={collapsed ? t.label : undefined}
        >
          {collapsed ? t.label.slice(0, 2).toUpperCase() : t.label}
        </button>
      ))}
    </nav>
  );
}
