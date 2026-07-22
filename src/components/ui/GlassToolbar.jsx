import "./glass.css";

export function GlassToolbar({ className = "", children, ...props }) {
  return (
    <div className={`glass-toolbar ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
