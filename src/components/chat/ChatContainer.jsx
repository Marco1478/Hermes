import { useEffect, useRef, useState } from "react";
import { useChat } from "../../state/Chat.jsx";
import { useViewMode } from "../../state/ViewMode.jsx";
import { BrandMark } from "../BrandMark.jsx";
import { MessageList } from "./MessageList.jsx";
import { ChatInput } from "./ChatInput.jsx";
import { ModelSelector } from "./ModelSelector.jsx";
import { SessionDrawer } from "./SessionDrawer.jsx";
import { StatusPanel } from "./StatusPanel.jsx";
import "./ChatContainer.css";

/*
  ChatContainer — the chat-mode shell. BrandMark (top-left, shared with
  the Hero) doubles as the way back; Escape does the same (unless the
  drawer is open, where Escape just closes it). The header carries the
  chats toggle, gateway HUD, per-chat model selector, new-chat, and esc.
*/
export function ChatContainer() {
  const { messages, thinking, send, retry, newChat, gatewayStatus, gatewayLatency } = useChat();
  const { enterHero } = useViewMode();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const hudRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (drawerOpen) {
        setDrawerOpen(false);
        return;
      }
      if (statusOpen) {
        setStatusOpen(false);
        return;
      }
      enterHero();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enterHero, drawerOpen, statusOpen]);

  return (
    <div className="chat-shell">
      <BrandMark />
      <SessionDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <header className="chat-header">
        <button
          type="button"
          className="chat-chats mono"
          onClick={() => setDrawerOpen((o) => !o)}
          title="Your chats"
          aria-label="Open chats"
        >
          <span className="chat-chats-lines" aria-hidden="true">
            ☰
          </span>
          <span className="chat-btn-label">chats</span>
        </button>

        <div className="chat-hud-anchor" ref={hudRef}>
          <button
            type="button"
            className="chat-hud mono"
            onClick={() => setStatusOpen((o) => !o)}
            aria-expanded={statusOpen}
            title="Hermes status"
          >
            <span className={`chat-status-dot chat-status-dot--${gatewayStatus}`} />
            <span className="chat-hud-label">
              gateway {gatewayStatus}
              {gatewayStatus === "online" && gatewayLatency != null ? ` ${gatewayLatency}ms` : ""}
            </span>
          </button>
          <StatusPanel open={statusOpen} onClose={() => setStatusOpen(false)} anchorRef={hudRef} />
        </div>

        <ModelSelector />

        <button
          type="button"
          className="chat-newsession mono"
          onClick={newChat}
          title="Start a new chat"
        >
          <span className="chat-newsession-plus" aria-hidden="true">
            +
          </span>
          <span className="chat-btn-label">new chat</span>
        </button>
        <button type="button" className="chat-back mono" onClick={enterHero}>
          esc
        </button>
      </header>

      <div className="chat-scroll">
        <div className="chat-constrain chat-constrain--scroll">
          <MessageList messages={messages} thinking={thinking} onRetry={retry} onSuggestion={send} />
        </div>
      </div>

      <div className="chat-constrain chat-constrain--dock">
        <ChatInput />
      </div>
    </div>
  );
}
