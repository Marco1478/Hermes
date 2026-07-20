import { useUsage } from "../state/Usage.jsx";
import "./UsageOrbs.css";

/* Compact token formatter: 12.3M / 456K / 789. */
function fmt(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

/*
  A single SVG progress ring. `pct` in [0,1]. Optional `innerPct` draws a
  second, inner ring (the "5-hour crown") inside the main one.
*/
function Ring({ pct, innerPct, label, value, sub, tone }) {
  const size = 96;
  const c = size / 2;
  const rOuter = 42;
  const rInner = 33;
  const circOuter = 2 * Math.PI * rOuter;
  const circInner = 2 * Math.PI * rInner;
  const pctText = `${Math.round(pct * 100)}%`;

  return (
    <div className={`orb orb--${tone}`}>
      <svg className="orb-svg" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${pctText}`}>
        {/* track(s) */}
        <circle className="orb-track" cx={c} cy={c} r={rOuter} strokeWidth="5" fill="none" />
        {innerPct != null && (
          <circle className="orb-track" cx={c} cy={c} r={rInner} strokeWidth="4" fill="none" />
        )}
        {/* outer arc (weekly) */}
        <circle
          className="orb-arc orb-arc--outer"
          cx={c}
          cy={c}
          r={rOuter}
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circOuter}
          strokeDashoffset={circOuter * (1 - pct)}
          transform={`rotate(-90 ${c} ${c})`}
        />
        {/* inner arc (5h crown) */}
        {innerPct != null && (
          <circle
            className="orb-arc orb-arc--inner"
            cx={c}
            cy={c}
            r={rInner}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circInner}
            strokeDashoffset={circInner * (1 - innerPct)}
            transform={`rotate(-90 ${c} ${c})`}
          />
        )}
      </svg>
      <div className="orb-center">
        <span className="orb-pct">{pctText}</span>
        <span className="orb-value mono">{value}</span>
      </div>
      <div className="orb-caption">
        <span className="orb-label mono">{label}</span>
        {sub && <span className="orb-sub mono">{sub}</span>}
      </div>
    </div>
  );
}

/*
  UsageOrbs — top-left-of-centre hero telemetry. Two orbs: OpenAI (the
  provider Hermes runs on) as a single weekly ring, and Anthropic (local
  Claude Code) as a weekly ring with an added inner crown for the rolling
  5-hour window. Token counts are real; percentages are vs. the budgets
  in config.js. See docs — no subscription API exposes true quota.
*/
export function UsageOrbs() {
  const { openai, anthropic } = useUsage();

  return (
    <div className="usage-orbs" aria-label="Token usage">
      <Ring
        tone="openai"
        pct={openai.pct}
        label="OPENAI · WK"
        value={`${fmt(openai.tokens)} tok`}
        sub={`of ${fmt(openai.budget)}`}
      />
      <Ring
        tone="anthropic"
        pct={anthropic.pctWeek}
        innerPct={anthropic.pct5h}
        label="CLAUDE"
        value={`${fmt(anthropic.tokens7d)} tok`}
        sub={anthropic.status === "error" ? "offline" : `5h ${fmt(anthropic.tokens5h)}`}
      />
    </div>
  );
}
