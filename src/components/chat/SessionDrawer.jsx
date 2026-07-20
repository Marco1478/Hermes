import { useEffect, useRef, useState } from "react";
import { useChat } from "../../state/Chat.jsx";
import "./SessionDrawer.css";

function relTime(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

/*
  SessionDrawer — a slide-in list of chats. Each chat is a separate
  short-context conversation (own Hermes session + model + history).
  Clicking one makes it active. Per-item actions: pin (keeps it at the
  top), export (downloads a markdown transcript), delete (blocked
  mid-run). Double-click (or the pencil) a title to rename it inline.
*/
export function SessionDrawer({ open, onClose }) {
  const { chatList, activeId, switchChat, newChat, deleteChat, runningChatId, renameChat, togglePin, exportChat } =
    useChat();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const searchRef = useRef(null);
  const editRef = useRef(null);

  useEffect(() => {
    if (open) {
      searchRef.current?.focus();
    } else {
      setQuery("");
      setEditingId(null);
    }
  }, [open]);

  useEffect(() => {
    if (editingId) editRef.current?.select();
  }, [editingId]);

  const q = query.trim().toLowerCase();
  const filtered = q ? chatList.filter((c) => c.title.toLowerCase().includes(q)) : chatList;

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditValue(c.title);
  };

  const commitEdit = () => {
    if (editingId) renameChat(editingId, editValue);
    setEditingId(null);
  };

  return (
    <>
      <div className={`drawer-scrim${open ? " drawer-scrim--on" : ""}`} onClick={onClose} aria-hidden={!open} />
      <aside className={`drawer${open ? " drawer--open" : ""}`} aria-label="Chats" aria-hidden={!open}>
        <div className="drawer-head">
          <span className="drawer-title mono">CHATS</span>
          <button
            type="button"
            className="drawer-new mono"
            onClick={() => {
              newChat();
              onClose();
            }}
          >
            + new
          </button>
        </div>
        <div className="drawer-search-row">
          <input
            ref={searchRef}
            type="text"
            className="drawer-search mono"
            placeholder="Search chats…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search chats"
          />
        </div>
        {filtered.length === 0 && (
          <p className="drawer-empty mono">{q ? "No chats match." : "No chats yet."}</p>
        )}
        <ul className="drawer-list">
          {filtered.map((c) => (
            <li key={c.id} className={`drawer-item${c.id === activeId ? " drawer-item--active" : ""}`}>
              {editingId === c.id ? (
                <input
                  ref={editRef}
                  type="text"
                  className="drawer-item-edit"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitEdit();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      setEditingId(null);
                    }
                  }}
                  aria-label="Rename chat"
                />
              ) : (
                <button
                  type="button"
                  className="drawer-item-main"
                  onClick={() => {
                    switchChat(c.id);
                    onClose();
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    startEdit(c);
                  }}
                >
                  <span className="drawer-item-title">
                    {c.pinned && (
                      <span className="drawer-item-pin-mark" aria-hidden="true">
                        ★
                      </span>
                    )}
                    {c.title}
                  </span>
                  <span className="drawer-item-meta mono">
                    {c.id === runningChatId && <span className="drawer-item-live" aria-hidden="true" />}
                    {c.empty ? "empty" : `${c.count} · ${relTime(c.updatedAt)}`}
                  </span>
                </button>
              )}
              <div className="drawer-item-actions">
                <button
                  type="button"
                  className={`drawer-item-icon${c.pinned ? " drawer-item-icon--active" : ""}`}
                  title={c.pinned ? "Unpin" : "Pin"}
                  aria-label={c.pinned ? "Unpin chat" : "Pin chat"}
                  onClick={() => togglePin(c.id)}
                >
                  ★
                </button>
                <button
                  type="button"
                  className="drawer-item-icon"
                  title="Rename"
                  aria-label="Rename chat"
                  onClick={() => startEdit(c)}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="drawer-item-icon"
                  title="Export as markdown"
                  aria-label="Export chat"
                  disabled={c.empty}
                  onClick={() => exportChat(c.id)}
                >
                  ⭳
                </button>
                <button
                  type="button"
                  className="drawer-item-icon drawer-item-icon--danger"
                  title="Delete chat"
                  aria-label="Delete chat"
                  disabled={c.id === runningChatId}
                  onClick={() => deleteChat(c.id)}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
}
