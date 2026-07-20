import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useChat } from "../state/Chat.jsx";
import { useViewMode } from "../state/ViewMode.jsx";
import "./CommandBar.css";

/*
  CommandBar — the idle-screen entry point. Focusing it (click, Cmd+K, or
  Space from anywhere on the page) morphs the view into chat; the same
  layoutId as ChatInput's bar is what makes Framer Motion animate one
  smoothly into the other instead of cross-fading two unrelated elements.
*/
export function CommandBar() {
  const { draft, setDraft, send } = useChat();
  const { enterChat } = useViewMode();
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        enterChat();
        inputRef.current?.focus();
      } else if (e.key === " " && !typing) {
        e.preventDefault();
        enterChat();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enterChat]);

  return (
    <div className="command-bar-dock">
      <motion.form
        layoutId="composer"
        className="command-bar"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <span className="command-bar-glyph mono" aria-hidden="true">
          /
        </span>
        <input
          ref={inputRef}
          className="command-bar-input"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => enterChat()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask Hermes, or press / for commands…"
          aria-label="Ask Hermes"
          autoComplete="off"
          spellCheck="false"
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
        />
        <span className="command-bar-kbd mono" aria-hidden="true">
          ⌘K
        </span>
      </motion.form>
    </div>
  );
}
