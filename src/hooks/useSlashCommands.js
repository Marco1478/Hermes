import { useEffect, useState } from "react";
import { HERMES_COMMANDS } from "../data/hermesCommands.js";

/*
  useSlashCommands — palette open/filter/selection state, decoupled from
  any particular input element so it can be reused (ChatInput today,
  CommandBar later if wanted). The palette opens while the draft is a
  single "/word" with no space yet (i.e. still typing the command name).
*/
export function useSlashCommands(draft, setDraft) {
  const isOpen = draft.startsWith("/") && !draft.slice(1).includes(" ");
  const query = isOpen ? draft.slice(1).toLowerCase() : "";
  const matches = isOpen ? HERMES_COMMANDS.filter((c) => c.name.startsWith(query)) : [];

  const [selectedIndex, setSelectedIndex] = useState(0);
  useEffect(() => {
    setSelectedIndex(0);
  }, [draft]);

  const pick = (cmd) => {
    setDraft(`/${cmd.name} `);
  };

  /* Returns true if it handled the key (caller should preventDefault and
     stop, e.g. not also submit the form on Enter). Escape must work even
     with zero matches (e.g. the command list is still empty) — only the
     selection-moving keys actually need a non-empty list. */
  const handleKeyDown = (e) => {
    if (!isOpen) return false;
    if (e.key === "Escape") {
      setDraft("");
      return true;
    }
    if (matches.length === 0) return false;
    if (e.key === "ArrowDown") {
      setSelectedIndex((i) => (i + 1) % matches.length);
      return true;
    }
    if (e.key === "ArrowUp") {
      setSelectedIndex((i) => (i - 1 + matches.length) % matches.length);
      return true;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      pick(matches[selectedIndex]);
      return true;
    }
    return false;
  };

  return { isOpen, matches, selectedIndex, pick, handleKeyDown };
}
