import "./glass.css";

/*
  GlassButton — the "important action" primitive (see glass.css header
  comment for why this exists alongside .btn-pill). variant picks the
  color language, size picks the footprint; "toolbar" is square-ish for
  icon-only buttons (canvas/kanban toolbars).
*/
export function GlassButton({ variant = "secondary", size, icon, className = "", type = "button", children, ...props }) {
  const classes = ["glass-btn", `glass-btn--${variant}`, size && `glass-btn--${size}`, className].filter(Boolean).join(" ");
  return (
    <button type={type} className={classes} {...props}>
      {icon}
      {children}
    </button>
  );
}
