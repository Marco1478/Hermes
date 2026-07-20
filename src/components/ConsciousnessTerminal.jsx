import { useEffect, useRef } from "react";
import "./ConsciousnessTerminal.css";

/*
  ConsciousnessTerminal — a micro-terminal pinned bottom-left, quiet by
  design (near-transparent until hovered). Every line it prints is a real
  event: gateway health polls (see useGatewayHealth) plus real UI
  lifecycle events passed in via `lines`. Nothing here is invented.
*/
export function ConsciousnessTerminal({ lines, status }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <div className="terminal" aria-hidden="true">
      <div className="terminal-head mono">
        <span className={`terminal-dot terminal-dot--${status}`} />
        hermes://core
      </div>
      <div className="terminal-body mono" ref={scrollRef}>
        {lines.map((l, i) => (
          <p key={i} className={`terminal-line terminal-line--${l.level}`}>
            <span className="terminal-t">{l.t}</span> {l.text}
          </p>
        ))}
      </div>
    </div>
  );
}
