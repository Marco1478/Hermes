import { useViewMode } from "../state/ViewMode.jsx";
import "./BrandMark.css";

/*
  BrandMark — small clickable logo, top-left, present in both hero and
  chat. The same line-art portrait used to anchor the corner (formerly a
  bigger, label-carrying "memory" widget) now doubles as the site's
  home button: click it from chat and you're back at the hero.
*/
export function BrandMark() {
  const { enterHero, isHero } = useViewMode();

  return (
    <button
      type="button"
      className="brandmark"
      onClick={enterHero}
      aria-label="Hermes — back to home"
      disabled={isHero}
    >
      <img className="brandmark-img" src="/memory-portrait-small.png" alt="" aria-hidden="true" />
      <span className="brandmark-word">Hermes</span>
    </button>
  );
}
