import { HERMES_COMMANDS } from "../../data/hermesCommands.js";
import "./CommandPalette.css";

/*
  CommandPalette — Telegram-style "/" autocomplete. Purely presentational;
  useSlashCommands.js owns the open/filter/selection state so ChatInput
  can wire keyboard nav (arrows, enter, escape) without this component
  needing to know about the input element at all.
*/
export function CommandPalette({ matches, selectedIndex, onPick }) {
  return (
    <div className="cmdpalette" role="listbox" aria-label="Hermes commands">
      {matches.length === 0 ? (
        <p className="cmdpalette-empty mono">
          {HERMES_COMMANDS.length === 0
            ? "No command list configured yet."
            : "No matching commands."}
        </p>
      ) : (
        matches.map((cmd, i) => (
          <button
            type="button"
            key={cmd.name}
            role="option"
            aria-selected={i === selectedIndex}
            className={`cmdpalette-item${i === selectedIndex ? " cmdpalette-item--active" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault(); /* keep focus in the text field */
              onPick(cmd);
            }}
          >
            <span className="cmdpalette-name mono">/{cmd.name}</span>
            <span className="cmdpalette-desc">{cmd.description}</span>
          </button>
        ))
      )}
    </div>
  );
}
