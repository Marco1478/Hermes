import { useEffect, useState } from "react";
import "./AgentThoughts.css";

/*
  AgentThoughts — a panel under a Hermes message showing what actually
  happened behind the reply (real tool-call events from the Runs API,
  see state/Chat.jsx). `thoughts` is an array of { label, detail };
  render nothing if empty rather than padding it out with filler.

  `live` (the message is still streaming) auto-opens the panel so you
  can watch tool calls as they happen, and auto-closes it once the run
  finishes — a manual toggle in between still works, it just resets
  on the next live/finished transition.
*/
export function AgentThoughts({ thoughts, live = false }) {
  const [open, setOpen] = useState(live);

  useEffect(() => {
    setOpen(live);
  }, [live]);

  if (!thoughts?.length) return null;

  return (
    <div className={`thoughts${open ? " thoughts--open" : ""}`}>
      <button
        type="button"
        className="thoughts-toggle mono"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="thoughts-caret" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
        {thoughts.length} step{thoughts.length === 1 ? "" : "s"}
        {live && <span className="thoughts-live" aria-hidden="true" />}
      </button>
      {open && (
        <ul className="thoughts-list mono">
          {thoughts.map((th, i) => (
            <li key={i} className="thoughts-item">
              <span className="thoughts-label">{th.label}</span>
              <span className="thoughts-detail">{th.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
