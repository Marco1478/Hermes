import { useState } from "react";
import { AgentThoughts } from "./AgentThoughts.jsx";
import { Markdown } from "../../lib/markdown.jsx";
import "./HermesMessage.css";

export function HermesMessage({ text, thoughts, isError = false, streaming = false, onRetry }) {
  const empty = !text && !(thoughts && thoughts.length);
  const [copied, setCopied] = useState(false);
  const done = !streaming && !empty;

  const copy = () => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        /* clipboard permission denied or unavailable — no toast, just no-op */
      });
  };

  return (
    <div className={`msg msg--hermes${isError ? " msg--error" : ""}`}>
      {isError ? (
        <span className="msg-mark mono" aria-hidden="true">
          !
        </span>
      ) : (
        <img
          className={`msg-mark msg-mark-img${streaming ? " msg-mark-img--live" : ""}`}
          src="/memory-portrait-small.png"
          alt=""
          aria-hidden="true"
        />
      )}
      <div className="msg-body">
        {empty && streaming ? (
          <span className="thinking-dots" aria-live="polite">
            <i />
            <i />
            <i />
          </span>
        ) : (
          <div className="msg-bubble">
            {isError ? <p className="md-p">{text}</p> : <Markdown text={text} />}
            {streaming && <span className="msg-caret" aria-hidden="true" />}
          </div>
        )}
        <AgentThoughts thoughts={thoughts} live={streaming} />
        {isError && onRetry && (
          <button type="button" className="msg-retry mono" onClick={onRetry}>
            retry
          </button>
        )}
        {!isError && done && (onRetry || text) && (
          <div className="msg-actions">
            {text && (
              <button type="button" className="msg-action" title="Copy" aria-label="Copy reply" onClick={copy}>
                {copied ? (
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="12" height="12" rx="2" />
                    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                  </svg>
                )}
              </button>
            )}
            {onRetry && (
              <button type="button" className="msg-action" title="Regenerate" aria-label="Regenerate reply" onClick={onRetry}>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 0 1 15.3-6.4L21 8" strokeLinecap="round" />
                  <path d="M21 3v5h-5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M21 12a9 9 0 0 1-15.3 6.4L3 16" strokeLinecap="round" />
                  <path d="M3 21v-5h5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
