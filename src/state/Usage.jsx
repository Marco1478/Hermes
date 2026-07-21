import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  OPENAI_WEEKLY_TOKEN_BUDGET,
  ANTHROPIC_5H_TOKEN_BUDGET,
  ANTHROPIC_WEEKLY_TOKEN_BUDGET,
} from "../config.js";
import { fetchAnthropicUsage } from "../lib/usage.js";
import { fetchAnalyticsUsage } from "../lib/hermesBridge.js";

const UsageContext = createContext(null);

const POLL_MS = 60000;

function clampPct(used, budget) {
  if (!budget || budget <= 0) return 0;
  return Math.max(0, Math.min(1, used / budget));
}

/* Sum input+output tokens over the last 7 daily analytics entries (cache
   reads excluded — same reasoning as the Claude side: they dwarf real
   consumption). The dashboard's /api/analytics/usage is REAL total Hermes
   usage across every platform (Telegram/Discord/UI), which is exactly what
   this orb was always trying to approximate — now it's the real number, not
   a UI-only localStorage tally. */
function weeklyFromAnalytics(daily) {
  if (!Array.isArray(daily)) return 0;
  const last7 = daily.slice(-7);
  return last7.reduce((sum, d) => sum + (d.input_tokens || 0) + (d.output_tokens || 0), 0);
}

/*
  UsageProvider — shared source for the hero usage orbs. OpenAI/Hermes usage
  is now REAL, polled from the dashboard's token analytics (see
  lib/hermesBridge.js); Anthropic usage is Marco's own local Claude Code
  transcripts (a different machine, dev usage — kept separate on purpose).
  Percentages are against the configurable budgets in config.js.
*/
export function UsageProvider({ children }) {
  const [openai, setOpenai] = useState({ status: "checking", tokens: 0 });
  const [anthropic, setAnthropic] = useState({ status: "checking", tokens5h: 0, tokens7d: 0, lastActivity: null });

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    let timer = null;
    const controller = new AbortController();

    async function poll() {
      const [openaiRes, anthropicRes] = await Promise.allSettled([
        fetchAnalyticsUsage(),
        fetchAnthropicUsage(controller.signal),
      ]);
      if (!mounted.current) return;

      if (openaiRes.status === "fulfilled") {
        setOpenai({ status: "ok", tokens: weeklyFromAnalytics(openaiRes.value?.daily) });
      } else {
        setOpenai((prev) => ({ ...prev, status: "error" }));
      }

      if (anthropicRes.status === "fulfilled") {
        const d = anthropicRes.value;
        setAnthropic({ status: "ok", tokens5h: d.tokens5h || 0, tokens7d: d.tokens7d || 0, lastActivity: d.lastActivity || null });
      } else if (anthropicRes.reason?.name !== "AbortError") {
        setAnthropic((prev) => ({ ...prev, status: "error" }));
      }

      if (mounted.current) timer = setTimeout(poll, POLL_MS);
    }
    poll();

    return () => {
      mounted.current = false;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, []);

  const value = useMemo(
    () => ({
      openai: {
        status: openai.status,
        tokens: openai.tokens,
        budget: OPENAI_WEEKLY_TOKEN_BUDGET,
        pct: clampPct(openai.tokens, OPENAI_WEEKLY_TOKEN_BUDGET),
      },
      anthropic: {
        status: anthropic.status,
        tokens5h: anthropic.tokens5h,
        tokens7d: anthropic.tokens7d,
        lastActivity: anthropic.lastActivity,
        budget5h: ANTHROPIC_5H_TOKEN_BUDGET,
        budgetWeek: ANTHROPIC_WEEKLY_TOKEN_BUDGET,
        pct5h: clampPct(anthropic.tokens5h, ANTHROPIC_5H_TOKEN_BUDGET),
        pctWeek: clampPct(anthropic.tokens7d, ANTHROPIC_WEEKLY_TOKEN_BUDGET),
      },
    }),
    [openai, anthropic]
  );

  return <UsageContext.Provider value={value}>{children}</UsageContext.Provider>;
}

export function useUsage() {
  const ctx = useContext(UsageContext);
  if (!ctx) throw new Error("useUsage must be used within UsageProvider");
  return ctx;
}
