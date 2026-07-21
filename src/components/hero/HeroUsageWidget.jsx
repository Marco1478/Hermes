import { useUsage } from "../../state/Usage.jsx";
import { useViewMode } from "../../state/ViewMode.jsx";
import { UsageRing } from "../UsageRing.jsx";
import "./HeroUsageWidget.css";

function fmt(n) {
  if (n == null) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

/*
  HeroUsageWidget — the one piece of telemetry the hero keeps: two small
  real usage rings, quietly in the corner. Everything else (machine,
  platforms, jobs, sessions…) lives on System Overview now (open it via
  BrandMark from the hero) — this stays deliberately small so it reads as
  "keep an eye on it", not a second dashboard.
*/
export function HeroUsageWidget() {
  const { openai, anthropic } = useUsage();
  const { goTo } = useViewMode();

  return (
    <button type="button" className="hero-usage-widget" onClick={() => goTo("system")} aria-label="Open system overview" title="Usage — open System Overview for details">
      <UsageRing size={58} tone="openai" pct={openai.pct} label="OPENAI" value={`${fmt(openai.tokens)}`} />
      <UsageRing size={58} tone="anthropic" pct={anthropic.pctWeek} innerPct={anthropic.pct5h} label="CLAUDE" value={`${fmt(anthropic.tokens7d)}`} />
    </button>
  );
}
