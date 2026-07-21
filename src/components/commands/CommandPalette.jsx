import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { COMMANDS } from "../../data/commandRegistry.js";
import { useCommandPaletteMode } from "../../state/CommandPaletteMode.jsx";
import { useViewMode } from "../../state/ViewMode.jsx";
import {
  fetchMessagingPlatforms,
  fetchHermesModels,
  fetchHermesToolsets,
  fetchHermesSkills,
  fetchCronJobs,
  fetchHermesProfiles,
  restartGateway,
} from "../../lib/hermesBridge.js";
import { fetchKanbanList } from "../../lib/kanbanBridge.js";
import "./CommandPalette.css";

const RISK_TONE = { safe: "ok", "state-changing": "warn", dangerous: "bad" };
const STATUS_LABEL = { available: "available", requires_backend: "needs backend", unsupported: "unsupported" };

/*
  CommandPalette — real Telegram-command parity surface. Executes the
  handful of commands this web UI genuinely has a working path for
  (navigation or a real bridge fetch); everything else shows its precise
  `note` from commandRegistry.js instead of pretending to run. Dangerous
  commands always go through a confirm step first, even though only
  /restart is wired to a real action right now.
*/
export function CommandPalette() {
  const { open, closePalette } = useCommandPaletteMode();
  const { goTo } = useViewMode();
  const [query, setQuery] = useState("");
  const [output, setOutput] = useState(null); // { forName, ok, text }
  const [pendingConfirm, setPendingConfirm] = useState(null); // command awaiting dangerous-action confirm
  const [running, setRunning] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMANDS;
    return COMMANDS.filter((c) => c.name.includes(q) || c.description.toLowerCase().includes(q) || c.category.includes(q));
  }, [query]);

  if (!open) return null;

  const closeAndReset = () => {
    closePalette();
    setQuery("");
    setOutput(null);
    setPendingConfirm(null);
  };

  async function execute(cmd) {
    setOutput(null);
    setRunning(true);
    try {
      switch (cmd.name) {
        case "help":
        case "commands":
          setOutput({ forName: cmd.name, ok: true, text: `${COMMANDS.length} commands registered — filter above, or scroll the categories.` });
          break;
        case "status":
        case "usage":
        case "profile":
          goTo("system");
          closeAndReset();
          return;
        case "history":
        case "save":
        case "image":
          goTo("chat");
          closeAndReset();
          return;
        case "tools":
        case "toolsets":
          goTo("tools");
          closeAndReset();
          return;
        case "skills":
        case "skill":
          goTo("hermes");
          closeAndReset();
          return;
        case "cron":
          goTo("jobs");
          closeAndReset();
          return;
        case "kanban": {
          const res = await fetchKanbanList({});
          setOutput({ forName: cmd.name, ok: true, text: `${res.data?.length ?? 0} active task(s) on the board. Opening Kanban…` });
          goTo("kanban");
          closeAndReset();
          return;
        }
        case "platforms": {
          const res = await fetchMessagingPlatforms();
          const enabled = (res.platforms || []).filter((p) => p.enabled);
          setOutput({ forName: cmd.name, ok: true, text: `${enabled.length} platform(s) enabled: ${enabled.map((p) => p.name || p.id).join(", ") || "none"}.` });
          break;
        }
        case "model": {
          const res = await fetchHermesModels();
          setOutput({
            forName: cmd.name,
            ok: true,
            text: res.configured ? `${res.options?.length ?? 0} model option(s) available (source: ${res.source}).` : "Dashboard not configured — no model list to show.",
          });
          break;
        }
        case "restart": {
          const result = await restartGateway();
          setOutput({ forName: cmd.name, ok: true, text: `Gateway restart requested: ${JSON.stringify(result)}` });
          break;
        }
        default: {
          // Reachable only for other "available" entries not special-cased
          // above (toolsets/skills read summaries) — fetch and summarize.
          if (cmd.name === "insights") {
            setOutput({ forName: cmd.name, ok: false, text: cmd.note });
          } else {
            const [toolsetsRes, skillsRes, cronRes, profRes] = await Promise.allSettled([
              fetchHermesToolsets(),
              fetchHermesSkills(),
              fetchCronJobs(),
              fetchHermesProfiles(),
            ]);
            setOutput({
              forName: cmd.name,
              ok: true,
              text: `toolsets:${toolsetsRes.status === "fulfilled" ? "ok" : "err"} skills:${skillsRes.status === "fulfilled" ? "ok" : "err"} cron:${cronRes.status === "fulfilled" ? "ok" : "err"} profiles:${profRes.status === "fulfilled" ? "ok" : "err"}`,
            });
          }
        }
      }
    } catch (err) {
      setOutput({ forName: cmd.name, ok: false, text: err.message || String(err) });
    } finally {
      setRunning(false);
      setPendingConfirm(null);
    }
  }

  function onPick(cmd) {
    if (cmd.status !== "available") {
      setOutput({ forName: cmd.name, ok: false, text: cmd.note });
      return;
    }
    if (cmd.risk !== "safe") {
      setPendingConfirm(cmd);
      return;
    }
    execute(cmd);
  }

  return (
    <motion.div className="cmdpal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeAndReset}>
      <motion.div
        className="glass-card cmdpal"
        initial={{ opacity: 0, scale: 0.97, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: -8 }}
        transition={{ type: "spring", stiffness: 460, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
      >
        <input
          className="cmdpal-search mono"
          autoFocus
          placeholder="Type a command or search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {output && (
          <p className={`cmdpal-output ${output.ok ? "cmdpal-output--ok" : "cmdpal-output--warn"} mono`}>{output.text}</p>
        )}

        {pendingConfirm && (
          <div className="cmdpal-confirm">
            <p className={pendingConfirm.risk === "dangerous" ? "panel-error" : "panel-empty"}>
              {pendingConfirm.risk === "dangerous" ? "Dangerous" : "State-changing"} — /{pendingConfirm.name}: {pendingConfirm.description}
            </p>
            <div className="cmdpal-confirm-actions">
              <button type="button" className="btn-pill" onClick={() => setPendingConfirm(null)} disabled={running}>
                cancel
              </button>
              <button
                type="button"
                className={`btn-pill${pendingConfirm.risk === "dangerous" ? " btn-pill--danger" : ""}`}
                onClick={() => execute(pendingConfirm)}
                disabled={running}
              >
                {running ? "running…" : `confirm /${pendingConfirm.name}`}
              </button>
            </div>
          </div>
        )}

        <div className="cmdpal-list" role="listbox" aria-label="Commands">
          {matches.length === 0 && <p className="panel-empty">No matching commands.</p>}
          {matches.map((cmd) => (
            <button key={cmd.name} type="button" className="cmdpal-item" role="option" onClick={() => onPick(cmd)}>
              <span className="cmdpal-item-name mono">/{cmd.name}</span>
              <span className="cmdpal-item-desc">{cmd.description}</span>
              <span className="tag-badge">{cmd.category}</span>
              <span className={`status-badge status-badge--${RISK_TONE[cmd.risk] || ""}`}>{cmd.risk}</span>
              <span className={`cmdpal-item-status cmdpal-item-status--${cmd.status}`}>{STATUS_LABEL[cmd.status]}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
