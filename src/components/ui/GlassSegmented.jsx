import "./glass.css";

/*
  GlassSegmented — a bigger, more tactile replacement for a row of loose
  .btn-pill toggles when the choice IS the primary thing on that row
  (e.g. active/archived, view mode). Usage:
    <GlassSegmented>
      <GlassSegmentedOption active={...} onClick={...}>active</GlassSegmentedOption>
      ...
    </GlassSegmented>
*/
export function GlassSegmented({ className = "", children, ...props }) {
  return (
    <div className={`glass-segmented ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function GlassSegmentedOption({ active, className = "", type = "button", children, ...props }) {
  return (
    <button type={type} className={`glass-segmented-btn${active ? " glass-segmented-btn--active" : ""} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
