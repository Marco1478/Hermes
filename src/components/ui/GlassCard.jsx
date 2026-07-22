import "./glass.css";

/*
  GlassCard / GlassPanel — thin, composable wrappers over the existing
  .glass-card (PageShell.css). GlassCard defaults to the interactive
  hover/press treatment (it's meant to be clicked/opened); GlassPanel is
  the static, non-interactive surface variant (a section container).
  `as` lets a card render as a real <button> when it needs to be one.
*/
export function GlassCard({ as: Tag = "div", interactive = true, className = "", children, ...props }) {
  const classes = ["glass-card", interactive && "glass-card--interactive", className].filter(Boolean).join(" ");
  return (
    <Tag className={classes} {...props}>
      {children}
    </Tag>
  );
}

export function GlassPanel({ as: Tag = "div", className = "", children, ...props }) {
  return (
    <Tag className={`glass-panel ${className}`.trim()} {...props}>
      {children}
    </Tag>
  );
}
