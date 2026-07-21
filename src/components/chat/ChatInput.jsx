import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useChat } from "../../state/Chat.jsx";
import { useViewMode } from "../../state/ViewMode.jsx";
import { useCommandPaletteMode } from "../../state/CommandPaletteMode.jsx";
import { useSlashCommands } from "../../hooks/useSlashCommands.js";
import { COMMANDS } from "../../data/commandRegistry.js";
import { CommandPalette } from "./CommandPalette.jsx";
import { FileVault } from "../files/FileVault.jsx";
import { fetchMessagingPlatforms, fetchHermesModels, fetchHermesToolsets, fetchHermesSkills, fetchCronJobs, fetchHermesProfiles } from "../../lib/hermesBridge.js";
import { fetchKanbanList } from "../../lib/kanbanBridge.js";
import "./ChatInput.css";
import "../files/FileVault.css";

const SpeechRecognitionAPI =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

/* Dictation language — Marco speaks Italian, so en-US mangled everything. */
const VOICE_LANG = "it-IT";

/* Text-like files are read as inline context (appended to the prompt);
   cap size so a huge file doesn't blow up the prompt. Images go through a
   different, real path — sent as multimodal image_url content parts on
   the Runs API, the same content-part vocabulary the gateway's OpenAI-
   compatible endpoint accepts (confirmed against
   gateway/platforms/api_server.py). PDFs/docs are deliberately excluded:
   the gateway explicitly rejects file/input_file content parts
   (unsupported_content_type) — there's no real backend path for them yet. */
const MAX_FILE_BYTES = 100 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const TEXT_ACCEPT =
  ".txt,.md,.markdown,.js,.jsx,.ts,.tsx,.json,.csv,.tsv,.py,.rb,.go,.rs,.java,.c,.cpp,.h,.html,.css,.scss,.yml,.yaml,.toml,.ini,.log,.xml,.sh,.env,text/*";
const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const ACCEPT = `${TEXT_ACCEPT},${IMAGE_ACCEPT}`;

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file.slice(0, MAX_FILE_BYTES));
  });
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/*
  ChatInput — the composer. <textarea>: Shift+Enter = newline, Enter =
  send. Auto-grows. The mic uses the real Web Speech API (Italian,
  continuous dictation) when supported. The clip button attaches text
  context files, sent to Hermes appended to the message (kept out of the
  visible bubble, shown as chips instead).
*/
export function ChatInput() {
  const {
    draft,
    setDraft,
    send,
    stop,
    retry,
    newChat,
    exportChat,
    activeId,
    messages,
    thinking,
    addLocalResponse,
  } = useChat();
  const { goTo } = useViewMode();
  const { openPalette } = useCommandPaletteMode();
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const recogRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [files, setFiles] = useState([]); /* {name, size, content} */
  const [rejections, setRejections] = useState([]); /* {name, reason} */
  const [previewName, setPreviewName] = useState(null);
  const [vaultOpen, setVaultOpen] = useState(false);
  const slash = useSlashCommands(draft, setDraft);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  useEffect(() => {
    if (!SpeechRecognitionAPI) return;
    const recog = new SpeechRecognitionAPI();
    recog.continuous = true;
    recog.interimResults = false;
    recog.lang = VOICE_LANG;
    recog.onresult = (e) => {
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
      }
      finalText = finalText.trim();
      if (finalText) setDraft((d) => (d ? `${d} ${finalText}` : finalText));
    };
    recog.onend = () => setListening(false);
    recog.onerror = () => setListening(false);
    recogRef.current = recog;
    return () => recog.abort();
  }, [setDraft]);

  const toggleMic = () => {
    if (!recogRef.current) return;
    if (listening) {
      recogRef.current.stop();
      setListening(false);
    } else {
      try {
        recogRef.current.start();
        setListening(true);
      } catch {
        /* start() throws if already started — ignore */
      }
    }
  };

  const onPickFiles = async (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = ""; /* allow re-picking the same file */
    const newRejections = [];
    const read = await Promise.all(
      picked.map(async (f) => {
        if (f.type.startsWith("image/")) {
          if (f.size > MAX_IMAGE_BYTES) {
            newRejections.push({ name: f.name, reason: `Size limit exceeded (${(f.size / 1024 / 1024).toFixed(1)}MB > 8MB).` });
            return null;
          }
          const dataUrl = await readAsDataUrl(f).catch(() => "");
          if (!dataUrl) newRejections.push({ name: f.name, reason: "Could not read file." });
          return dataUrl ? { name: f.name, size: f.size, isImage: true, dataUrl } : null;
        }
        const content = await readAsText(f).catch(() => "");
        if (!content) newRejections.push({ name: f.name, reason: "Could not read file as text." });
        return content ? { name: f.name, size: f.size, truncated: f.size > MAX_FILE_BYTES, content } : null;
      })
    );
    setFiles((prev) => [...prev, ...read.filter(Boolean)]);
    if (newRejections.length) setRejections((prev) => [...prev, ...newRejections]);
  };

  const removeFile = (name) => setFiles((prev) => prev.filter((f) => f.name !== name));
  const dismissRejection = (name) => setRejections((prev) => prev.filter((r) => r.name !== name));

  const executeSlashCommand = async (text) => {
    const [rawName, ...args] = text.slice(1).trim().split(/\s+/);
    const name = (rawName || "").toLowerCase();
    const cmd = COMMANDS.find((c) => c.name === name);
    const say = (msg, isError = false) => addLocalResponse(text, msg, { isError });

    if (!name) {
      openPalette();
      say("Command Palette aperta. Cerca un comando o continua a scrivere dopo `/`.");
      return;
    }
    if (!cmd) {
      say(`Comando /${name} non riconosciuto. Usa /help o Ctrl/Cmd+K per vedere i comandi disponibili.`, true);
      return;
    }

    // UI-local commands that are actually possible from this chat surface.
    if (name === "new" || name === "reset") {
      newChat();
      return;
    }
    if (name === "stop") {
      if (thinking) stop();
      else say("Nessuna run attiva da fermare.");
      return;
    }
    if (name === "retry") {
      const lastHermes = [...messages].reverse().find((m) => m.role === "hermes" && !m.streaming);
      if (lastHermes) retry(lastHermes.id);
      else say("Non c'è ancora una risposta Hermes da rilanciare.", true);
      return;
    }
    if (name === "save") {
      if (activeId) exportChat(activeId);
      say("Export della chat avviato dal browser.");
      return;
    }
    if (name === "image" || name === "paste") {
      fileRef.current?.click();
      say(name === "image" ? "Selettore file aperto: immagini supportate come input reale al modello." : "Il paste nativo del browser funziona nel composer; per immagini/file usa anche il pulsante attach.");
      return;
    }

    if (cmd.status !== "available") {
      say(`/${cmd.name} non può essere utilizzato direttamente da questa chat UI. Motivo: ${cmd.note}`, true);
      return;
    }
    if (cmd.risk !== "safe") {
      say(`/${cmd.name} è ${cmd.risk} e richiede conferma visiva nella Command Palette/Safety Center. Motivo: ${cmd.note}`, true);
      openPalette();
      return;
    }

    try {
      switch (name) {
        case "help":
        case "commands":
          say(
            `${COMMANDS.length} comandi registrati. Esempi eseguibili qui: /status, /kanban, /cron, /tools, /skills, /platforms, /model, /new, /retry, /stop. ` +
              `Se un comando è solo Telegram/CLI o richiede conferma, la chat lo spiega invece di fingere successo.`
          );
          return;
        case "status":
        case "usage":
        case "profile":
          goTo("system");
          say(`/${name}: apro System Overview con i dati reali del backend.`);
          return;
        case "platforms": {
          const res = await fetchMessagingPlatforms();
          const platforms = (res.platforms || []).map((p) => `${p.name || p.id}:${p.enabled ? p.status || "enabled" : "off"}`).join(", ") || "nessuna";
          say(`/platforms → ${platforms}`);
          return;
        }
        case "model": {
          const res = await fetchHermesModels();
          say(res.configured ? `/model → ${res.options?.length ?? 0} opzioni disponibili. Per cambiare modello usa Hermes/System; il cambio è globale.` : "/model → dashboard non configurata.");
          return;
        }
        case "tools":
        case "toolsets": {
          const res = await fetchHermesToolsets();
          goTo("tools");
          say(`/${name} → ${res.toolsets?.filter((t) => t.enabled).length ?? 0}/${res.toolsets?.length ?? 0} toolset attivi. Apro Tools.`);
          return;
        }
        case "skills": {
          const res = await fetchHermesSkills();
          goTo("hermes");
          say(`/skills → ${res.skills?.length ?? 0} skill rilevate. Apro Hermes.`);
          return;
        }
        case "cron": {
          const res = await fetchCronJobs();
          goTo("jobs");
          say(`/cron → ${(res.jobs || res || []).length ?? 0} job letti. Apro Jobs.`);
          return;
        }
        case "kanban": {
          const res = await fetchKanbanList({});
          goTo("kanban");
          say(`/kanban → ${res.data?.length ?? 0} task attivi. Apro Kanban.`);
          return;
        }
        case "history":
          goTo("chat");
          say("/history → la cronologia è nel drawer Chats a sinistra della chat.");
          return;
        default: {
          const [toolsetsRes, skillsRes, cronRes, profRes] = await Promise.allSettled([fetchHermesToolsets(), fetchHermesSkills(), fetchCronJobs(), fetchHermesProfiles()]);
          say(`/${name} → check bridge: toolsets=${toolsetsRes.status} skills=${skillsRes.status} cron=${cronRes.status} profiles=${profRes.status}.`);
        }
      }
    } catch (err) {
      say(`/${name} fallito: ${err.message || String(err)}`, true);
    }
  };

  const submit = async () => {
    if (thinking) return;
    const text = draft.trim();
    if (!text && files.length === 0) return;
    if (text.startsWith("/") && files.length === 0) {
      setDraft("");
      await executeSlashCommand(text);
      return;
    }
    if (files.length) {
      const textFiles = files.filter((f) => !f.isImage);
      const images = files.filter((f) => f.isImage);
      const contextText = textFiles.length
        ? textFiles.map((f) => `--- FILE: ${f.name}${f.truncated ? " (troncato)" : ""} ---\n${f.content}`).join("\n\n")
        : undefined;
      send(text, {
        contextText,
        images: images.length ? images.map((f) => ({ dataUrl: f.dataUrl })) : undefined,
        files: files.map((f) => ({ name: f.name })),
      });
      setDraft("");
      setFiles([]);
    } else {
      send();
    }
  };

  return (
    <div className="chat-input-shell">
      {(files.length > 0 || rejections.length > 0) && (
        <div className="chat-attachments">
          {files.map((f) => (
            <span key={f.name} className="chat-attach-chip mono">
              <button
                type="button"
                className="chat-attach-clip"
                onClick={() => !f.isImage && setPreviewName((p) => (p === f.name ? null : f.name))}
                aria-label={f.isImage ? f.name : `Preview ${f.name}`}
                title={f.isImage ? f.name : "Click to preview"}
              >
                ⎘
              </button>
              {f.name}
              {f.truncated && <span className="tag-badge">truncated</span>}
              <button
                type="button"
                className="chat-attach-x"
                onClick={() => removeFile(f.name)}
                aria-label={`Remove ${f.name}`}
              >
                ×
              </button>
              {!f.isImage && previewName === f.name && <pre className="chat-attach-preview">{f.content.slice(0, 500)}</pre>}
            </span>
          ))}
          {rejections.map((r) => (
            <span key={r.name} className="chat-attach-chip mono chat-attach-rejection">
              {r.name}: {r.reason}
              <button type="button" className="chat-attach-x" onClick={() => dismissRejection(r.name)} aria-label={`Dismiss ${r.name}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <motion.form
        layoutId="composer"
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {slash.isOpen && (
          <CommandPalette matches={slash.matches} selectedIndex={slash.selectedIndex} onPick={slash.pick} />
        )}
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="chat-file-input"
          onChange={onPickFiles}
          tabIndex={-1}
          aria-hidden="true"
        />
        <div className="chat-clip-group">
          <button
            type="button"
            className="chat-clip"
            onClick={() => fileRef.current?.click()}
            title="Attach files — text/code as context, images sent directly to the model"
            aria-label="Attach files"
          >
            ⎘
          </button>
          <button
            type="button"
            className="chat-clip-info"
            onClick={() => setVaultOpen((v) => !v)}
            title="What file types are supported?"
            aria-label="File support info"
          >
            ⓘ
          </button>
          {vaultOpen && <FileVault onClose={() => setVaultOpen(false)} />}
        </div>
        <textarea
          ref={inputRef}
          className="chat-input-field"
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (slash.handleKeyDown(e)) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Message Hermes, or / for commands…"
          aria-label="Message Hermes"
          autoComplete="off"
          spellCheck="false"
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
        />
        <button
          type="button"
          className={`chat-mic${listening ? " chat-mic--live" : ""}`}
          onClick={toggleMic}
          disabled={!SpeechRecognitionAPI}
          title={SpeechRecognitionAPI ? "Detta con la voce (italiano)" : "Voice input not supported in this browser"}
          aria-pressed={listening}
          aria-label="Toggle voice input"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" strokeLinecap="round" />
            <line x1="12" y1="18" x2="12" y2="21" strokeLinecap="round" />
          </svg>
        </button>
        {thinking ? (
          <button type="button" className="chat-send chat-send--stop mono" onClick={stop}>
            Stop
          </button>
        ) : (
          <button type="submit" className="chat-send mono" disabled={!draft.trim() && files.length === 0}>
            Send
          </button>
        )}
      </motion.form>
    </div>
  );
}
