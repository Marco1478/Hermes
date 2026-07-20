import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  OPENAI_WEEKLY_TOKEN_BUDGET,
  ANTHROPIC_5H_TOKEN_BUDGET,
  ANTHROPIC_WEEKLY_TOKEN_BUDGET,
} from "../config.js";
import { getOpenAiUsage, addOpenAiTokens, fetchAnthropicUsage } from "../lib/usage.js";

const UsageContext = createContext(null);

const ANTHROPIC_POLL_MS = 60000;

function clampPct(used, budget) {
  if (!budget || budget <= 0) return 0;
  return Math.max(0, Math.min(1, used / budget));
}

/*
  UsageProvider — the shared source for the hero usage rings. OpenAI usage
  is a local weekly accumulator fed by Chat (addTokens on each completed
  run); Anthropic usage is polled from the dev endpoint that reads local
  Claude Code transcripts. Both token counts are real; the percentages are
  against the configurable budgets in config.js.
*/
export function UsageProvider({ children }) {
  const [openai, setOpenai] = useState(() => getOpenAiUsage());
  const [anthropic, setAnthropic] = useState({
    status: "checking",
    tokens5h: 0,
    tokens7d: 0,
    lastActivity: null,
  });

  const addTokens = useCallback((tokens) => {
    setOpenai(addOpenAiTokens(tokens));
  }, []);

  /* Roll the OpenAI bucket over if the week elapses while the tab is open. */
  useEffect(() => {
    const id = setInterval(() => setOpenai(getOpenAiUsage()), 60000);
    return () => clearInterval(id);
  }, []);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    let timer = null;
    const controller = new AbortController();

    async function poll() {
      try {
        const data = await fetchAnthropicUsage(controller.signal);
        if (!mounted.current) return;
        setAnthropic({
          status: "ok",
          tokens5h: data.tokens5h || 0,
          tokens7d: data.tokens7d || 0,
          lastActivity: data.lastActivity || null,
        });
      } catch (err) {
        if (!mounted.current || err?.name === "AbortError") return;
        setAnthropic((prev) => ({ ...prev, status: "error" }));
      }
      if (mounted.current) timer = setTimeout(poll, ANTHROPIC_POLL_MS);
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
      addTokens,
      openai: {
        tokens: openai.tokens,
        weekStart: openai.weekStart,
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
    [openai, anthropic, addTokens]
  );

  return <UsageContext.Provider value={value}>{children}</UsageContext.Provider>;
}

export function useUsage() {
  const ctx = useContext(UsageContext);
  if (!ctx) throw new Error("useUsage must be used within UsageProvider");
  return ctx;
}
