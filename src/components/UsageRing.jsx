import "./UsageRing.css";

/*
  UsageRing — the one circular usage indicator, shared by the compact
  hero widget and the richer System Overview page (just a different
  `size`). `pct` in [0,1]; optional `innerPct` draws a second, inner ring
  (the "5-hour crown") inside the main one.
*/
export function UsageRing({ pct, innerPct, label, value, sub, tone, size = 84 }) {
  const c = size / 2;
  const rOuter = size * 0.43;
  const rInner = size * 0.33;
  const strokeOuter = Math.max(3, size * 0.06);
  const strokeInner = Math.max(2.5, size * 0.048);
  const circOuter = 2 * Math.PI * rOuter;
  const circInner = 2 * Math.PI * rInner;
  const pctText = `${Math.round((pct || 0) * 100)}%`;

  return (
    <div className={`usage-ring orb orb--${tone}`} style={{ width: size }}>
      <svg className="orb-svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${pctText}`}>
        <circle className="orb-track" cx={c} cy={c} r={rOuter} strokeWidth={strokeOuter} fill="none" />
        {innerPct != null && <circle className="orb-track" cx={c} cy={c} r={rInner} strokeWidth={strokeInner} fill="none" />}
        <circle
          className="orb-arc orb-arc--outer"
          cx={c}
          cy={c}
          r={rOuter}
          strokeWidth={strokeOuter}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circOuter}
          strokeDashoffset={circOuter * (1 - (pct || 0))}
          transform={`rotate(-90 ${c} ${c})`}
        />
        {innerPct != null && (
          <circle
            className="orb-arc orb-arc--inner"
            cx={c}
            cy={c}
            r={rInner}
            strokeWidth={strokeInner}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circInner}
            strokeDashoffset={circInner * (1 - innerPct)}
            transform={`rotate(-90 ${c} ${c})`}
          />
        )}
      </svg>
      <div className="orb-center" style={{ top: size * 0.5 }}>
        <span className="orb-pct" style={{ fontSize: size * 0.185 }}>
          {pctText}
        </span>
        {value && (
          <span className="orb-value mono" style={{ fontSize: size * 0.098 }}>
            {value}
          </span>
        )}
      </div>
      <div className="orb-caption">
        <span className="orb-label mono" style={{ fontSize: size * 0.1 }}>
          {label}
        </span>
        {sub && (
          <span className="orb-sub mono" style={{ fontSize: size * 0.096 }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}
