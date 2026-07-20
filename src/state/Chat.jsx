import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useViewMode } from "./ViewMode.jsx";
import { useGateway } from "./GatewayHealth.jsx";
import { useUsage } from "./Usage.jsx";
import { createRun, stopRun, subscribeRunEvents } from "../lib/gatewayRuns.js";
import { chatToMarkdown, downloadText, slugify } from "../lib/exportChat.js";
import { DEFAULT_MODEL } from "../data/hermesModels.js";

const ChatContext = createContext(null);
const STORE_KEY = "hermes-ui.chats.v1";
const ACTIVE_KEY = "hermes-ui.active-chat.v1";

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toolLabel(tool) {
  return tool || "tool";
}

function emptyChat() {
  return {
    id: uid(),
    title: "",
    sessionId: null,
    model: DEFAULT_MODEL,
    messages: [],
    updatedAt: Date.now(),
    pinned: false,
  };
}

function deriveTitle(text) {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 42 ? `${t.slice(0, 42)}…` : t;
}

/* Load persisted chats, sanitising any run that was streaming when the tab
   closed (it can never resume — the SSE socket is gone). */
function loadChats() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(data) || data.length === 0) return [emptyChat()];
    return data.map((c) => ({
      id: c.id || uid(),
      title: c.title || "",
      sessionId: c.sessionId ?? null,
      model: c.model || DEFAULT_MODEL,
      updatedAt: c.updatedAt || Date.now(),
      pinned: Boolean(c.pinned),
      messages: (c.messages || []).map((m) =>
        m.streaming
          ? { ...m, streaming: false, ...(!m.text && !m.isError ? { text: "[interrotto]", isError: true } : {}) }
          : m
      ),
    }));
  } catch {
    return [emptyChat()];
  }
}

/*
  Chat — a store of multiple client-side conversations ("chats"), each with
  its own Hermes session_id, model, and message history, persisted to
  localStorage so they survive reloads. Only one run is in flight at a time
  (the gateway runs a single agent); a run keeps patching its own chat even
  if the user switches away. See lib/gatewayRuns.js for the Runs API.
*/
export function ChatProvider({ children }) {
  const { enterChat } = useViewMode();
  const gateway = useGateway();
  const { addTokens } = useUsage();
  const [draft, setDraft] = useState("");
  const [chats, setChats] = useState(loadChats);
  const [activeId, setActiveId] = useState(() => {
    const saved = localStorage.getItem(ACTIVE_KEY);
    return saved || null;
  });
  const activeRef = useRef(null); /* { chatId, messageId, runId, abort } | null */

  /* Keep a ref of chats so async run callbacks read the latest without
     being re-created on every token. */
  const chatsRef = useRef(chats);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  /* Ensure activeId always points at a real chat. */
  useEffect(() => {
    if (!activeId || !chats.some((c) => c.id === activeId)) {
      setActiveId(chats[0]?.id ?? null);
    }
  }, [activeId, chats]);

  /* Persist (debounced so streaming deltas don't thrash localStorage). */
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(chats));
      } catch {
        /* quota — best-effort */
      }
    }, 400);
    return () => clearTimeout(id);
  }, [chats]);
  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId);
  }, [activeId]);

  const patchChat = useCallback((chatId, patch) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, ...(typeof patch === "function" ? patch(c) : patch), updatedAt: Date.now() } : c))
    );
  }, []);

  const patchMessage = useCallback(
    (chatId, messageId, patch) => {
      setChats((prev) =>
        prev.map((c) =>
          c.id !== chatId
            ? c
            : {
                ...c,
                updatedAt: Date.now(),
                messages: c.messages.map((m) =>
                  m.id === messageId ? { ...m, ...(typeof patch === "function" ? patch(m) : patch) } : m
                ),
              }
        )
      );
    },
    []
  );

  const runFor = useCallback(
    (text, chatId, messageId) => {
      const chat = chatsRef.current.find((c) => c.id === chatId);
      const sid = chat?.sessionId || null;
      const model = chat?.model || DEFAULT_MODEL;
      createRun(text, sid, { model })
        .then(({ runId, sessionId: newSid }) => {
          if (!sid) patchChat(chatId, { sessionId: newSid });
          activeRef.current = { chatId, messageId, runId, abort: null };
          const abort = subscribeRunEvents(runId, {
            onDelta: (delta) => {
              patchMessage(chatId, messageId, (m) => ({ text: (m.text || "") + delta }));
            },
            onTool: ({ phase, tool, preview, duration, error }) => {
              patchMessage(chatId, messageId, (m) => ({
                thoughts: [
                  ...(m.thoughts || []),
                  phase === "start"
                    ? { label: toolLabel(tool), detail: preview ? `started — ${preview}` : "started" }
                    : {
                        label: toolLabel(tool),
                        detail: error ? `failed (${duration ?? "?"}s)` : `done (${duration ?? "?"}s)`,
                      },
                ],
              }));
            },
            onReasoning: (text2) => {
              patchMessage(chatId, messageId, (m) => ({
                thoughts: [...(m.thoughts || []), { label: "reasoning", detail: text2 }],
              }));
            },
            onDone: ({ status, output, usage }) => {
              activeRef.current = null;
              if (usage?.total_tokens) addTokens(usage.total_tokens);
              if (status === "completed") {
                gateway.log?.("ok", `[Chat]: run completed${usage ? ` — ${usage.total_tokens} tokens` : ""}`);
              } else if (status === "cancelled") {
                gateway.log?.("warn", "[Chat]: run stopped by user");
              } else {
                gateway.log?.("warn", `[Chat]: run ${status}`);
              }
              patchMessage(chatId, messageId, (m) => ({
                text: output != null ? output : status === "cancelled" ? `${m.text || ""}\n\n[stopped]` : m.text,
                streaming: false,
                thoughts: usage
                  ? [...(m.thoughts || []), { label: "usage", detail: `${usage.total_tokens} tokens` }]
                  : m.thoughts,
              }));
            },
            onError: (err) => {
              activeRef.current = null;
              gateway.log?.("error", `[Chat]: run failed — ${err.message}`);
              patchMessage(chatId, messageId, {
                streaming: false,
                isError: true,
                text: `Couldn't get a reply: ${err.message}`,
              });
            },
          });
          if (activeRef.current) activeRef.current.abort = abort;
        })
        .catch((err) => {
          activeRef.current = null;
          gateway.log?.("error", `[Chat]: couldn't start run — ${err.message}`);
          patchMessage(chatId, messageId, {
            streaming: false,
            isError: true,
            text: `Couldn't get a reply: ${err.message}`,
            thoughts: [{ label: "Gateway", detail: gateway.status }],
          });
        });
    },
    [patchChat, patchMessage, addTokens, gateway.status, gateway.log]
  );

  const send = useCallback(
    (overrideText, extra) => {
      const text = (overrideText ?? draft).trim();
      if ((!text && !extra?.contextText) || activeRef.current) return;
      const cid = activeId || chatsRef.current[0]?.id;
      if (!cid) return;
      enterChat();
      if (overrideText == null) setDraft("");
      const files = extra?.files || null;
      /* File context is appended to what Hermes receives but kept out of the
         visible bubble (which shows the typed text + file chips instead). */
      const fullInput = extra?.contextText ? `${text}\n\n${extra.contextText}` : text;
      const userMsgId = uid();
      const hermesMsgId = uid();
      setChats((prev) =>
        prev.map((c) =>
          c.id !== cid
            ? c
            : {
                ...c,
                title: c.title || deriveTitle(text || (files?.[0]?.name ?? "file")),
                updatedAt: Date.now(),
                messages: [
                  ...c.messages,
                  { id: userMsgId, role: "user", text, files },
                  { id: hermesMsgId, role: "hermes", text: "", thoughts: [], streaming: true, sourceInput: fullInput },
                ],
              }
        )
      );
      runFor(fullInput, cid, hermesMsgId);
    },
    [draft, enterChat, runFor, activeId]
  );

  const stop = useCallback(() => {
    const active = activeRef.current;
    if (!active) return;
    stopRun(active.runId).catch(() => {});
  }, []);

  const retry = useCallback(
    (messageId) => {
      if (activeRef.current) return;
      const cid = activeId;
      const chat = chatsRef.current.find((c) => c.id === cid);
      const msg = chat?.messages.find((m) => m.id === messageId);
      if (!msg) return;
      patchMessage(cid, messageId, { text: "", thoughts: [], streaming: true, isError: false });
      runFor(msg.sourceInput, cid, messageId);
    },
    [activeId, patchMessage, runFor]
  );

  /* Open a brand-new empty chat and focus it. Existing chats are kept. */
  const newChat = useCallback(() => {
    const c = emptyChat();
    setChats((prev) => [c, ...prev]);
    setActiveId(c.id);
    setDraft("");
  }, []);

  const switchChat = useCallback((id) => {
    setActiveId(id);
    setDraft("");
  }, []);

  const deleteChat = useCallback((id) => {
    if (activeRef.current?.chatId === id) return; /* don't nuke a chat mid-run */
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      return next.length ? next : [emptyChat()];
    });
  }, []);

  const setModel = useCallback(
    (modelId) => {
      const cid = activeId;
      if (!cid) return;
      patchChat(cid, { model: modelId });
    },
    [activeId, patchChat]
  );

  const renameChat = useCallback(
    (id, title) => {
      const clean = title.trim();
      if (!clean) return;
      patchChat(id, { title: clean });
    },
    [patchChat]
  );

  const togglePin = useCallback(
    (id) => {
      patchChat(id, (c) => ({ pinned: !c.pinned }));
    },
    [patchChat]
  );

  const exportChat = useCallback((id) => {
    const chat = chatsRef.current.find((c) => c.id === id);
    if (!chat) return;
    downloadText(`hermes-${slugify(chat.title)}.md`, chatToMarkdown(chat));
  }, []);

  const activeChat = useMemo(() => chats.find((c) => c.id === activeId) || chats[0] || null, [chats, activeId]);
  const messages = activeChat?.messages ?? [];
  const thinking = messages.some((m) => m.streaming);
  const runningChatId = activeRef.current?.chatId ?? null;

  /* Lightweight list for the session drawer (no message payloads). */
  const chatList = useMemo(
    () =>
      chats
        .map((c) => ({
          id: c.id,
          title: c.title || "New chat",
          model: c.model,
          count: c.messages.length,
          updatedAt: c.updatedAt,
          empty: c.messages.length === 0,
          pinned: Boolean(c.pinned),
        }))
        .sort((a, b) => (b.pinned !== a.pinned ? (b.pinned ? 1 : -1) : b.updatedAt - a.updatedAt)),
    [chats]
  );

  const value = useMemo(
    () => ({
      draft,
      setDraft,
      messages,
      thinking,
      send,
      stop,
      retry,
      newChat,
      switchChat,
      deleteChat,
      setModel,
      renameChat,
      togglePin,
      exportChat,
      chatList,
      activeId: activeChat?.id ?? null,
      activeModel: activeChat?.model ?? DEFAULT_MODEL,
      hasSession: (activeChat?.sessionId ?? null) != null,
      runningChatId,
      gatewayStatus: gateway.status,
      gatewayLatency: gateway.latencyMs,
    }),
    [
      draft,
      messages,
      thinking,
      send,
      stop,
      retry,
      newChat,
      switchChat,
      deleteChat,
      setModel,
      renameChat,
      togglePin,
      exportChat,
      chatList,
      activeChat,
      runningChatId,
      gateway.status,
      gateway.latencyMs,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
