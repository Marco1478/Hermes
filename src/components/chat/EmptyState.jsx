import "./EmptyState.css";

const SUGGESTIONS = [
  "What can you help me with?",
  "What tools do you have access to?",
  "Give me a quick status update.",
  "Tell me something interesting.",
];

/*
  EmptyState — shown before the first message. Fills the otherwise-bare
  chat screen with the Hermes mark and a few one-click conversation
  starters (onSuggestion sends immediately, bypassing the draft).
*/
export function EmptyState({ onSuggestion }) {
  return (
    <div className="chat-empty">
      <img className="chat-empty-mark" src="/memory-portrait-small.png" alt="" aria-hidden="true" />
      <p className="chat-empty-title">Hermes is listening.</p>
      <p className="chat-empty-sub mono">Ask anything, or try one of these</p>
      <div className="chat-empty-suggestions">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="chat-empty-chip mono" onClick={() => onSuggestion(s)}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
