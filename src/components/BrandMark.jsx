import { useViewMode } from "../state/ViewMode.jsx";
import "./BrandMark.css";

/*
  BrandMark — small clickable logo, top-left, present on every page.
  Contextual: anywhere else it's the way back to the hero; already on the
  hero it instead opens System Overview (the hero has no other route to
  it — no floating panel there anymore, see SystemOverviewPage.jsx).
*/
export function BrandMark() {
  const { enterHero, isHero, goTo } = useViewMode();

  return (
    <button
      type="button"
      className="brandmark"
      onClick={() => (isHero ? goTo("system") : enterHero())}
      aria-label={isHero ? "Open system overview" : "Hermes — back to home"}
    >
      <img className="brandmark-img" src="/memory-portrait-small.png" alt="" aria-hidden="true" />
      <span className="brandmark-word">Hermes</span>
    </button>
  );
}
