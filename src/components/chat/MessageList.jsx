import { useEffect, useRef } from "react";
import { UserMessage } from "./UserMessage.jsx";
import { HermesMessage } from "./HermesMessage.jsx";
import { EmptyState } from "./EmptyState.jsx";
import "./MessageList.css";

/* How close to the bottom (px) still counts as "following along". */
const NEAR_BOTTOM_PX = 120;

export function MessageList({ messages, thinking, onRetry, onSuggestion }) {
  const endRef = useRef(null);
  const nearBottomRef = useRef(true);
  const prevLenRef = useRef(messages.length);

  /* Track the user's real scroll position on the ancestor .chat-scroll
     (owned by ChatContainer, found via closest() rather than threading a
     ref down) continuously, independent of content changes — so we know
     whether they'd already scrolled up BEFORE new content arrives. */
  useEffect(() => {
    const container = endRef.current?.closest(".chat-scroll");
    if (!container) return;
    const onScroll = () => {
      const dist = container.scrollHeight - container.scrollTop - container.clientHeight;
      nearBottomRef.current = dist < NEAR_BOTTOM_PX;
    };
    onScroll();
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  /* Always follow a newly-appended message (you just sent one, or Hermes
     just started replying) — but during in-place streaming edits to an
     existing message, only auto-follow if you hadn't scrolled away to
     reread something. Getting yanked back down mid-read was the bug. */
  useEffect(() => {
    const grew = messages.length !== prevLenRef.current;
    prevLenRef.current = messages.length;
    if (grew || nearBottomRef.current) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, thinking]);

  if (!messages.length) {
    return (
      <div className="messages messages--empty">
        <EmptyState onSuggestion={onSuggestion} />
      </div>
    );
  }

  return (
    <div className="messages">
      {messages.map((m) =>
        m.role === "user" ? (
          <UserMessage key={m.id} text={m.text} files={m.files} />
        ) : (
          <HermesMessage
            key={m.id}
            text={m.text}
            thoughts={m.thoughts}
            isError={m.isError}
            streaming={m.streaming}
            onRetry={() => onRetry?.(m.id)}
          />
        )
      )}
      <div ref={endRef} />
    </div>
  );
}
