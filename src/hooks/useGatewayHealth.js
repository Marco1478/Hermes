import { useEffect, useRef, useState } from "react";
import { GATEWAY_BASE_URL, GATEWAY_FETCH_BASE, GATEWAY_API_KEY } from "../config.js";

const POLL_MS = 8000;
const TIMEOUT_MS = 4000;
const MAX_LINES = 60;

function stamp() {
  const d = new Date();
  return d.toTimeString().slice(0, 8);
}

/*
  useGatewayHealth — the ONE real telemetry source in this UI. Polls the
  actual Hermes gateway's /health/detailed endpoint (the same one
  referenced in docs/docker.md for verifying the gateway is up) and turns
  every real outcome into a log line: reachable, unreachable, blocked by
  CORS, or timed out. Nothing here is simulated — a quiet gateway means a
  quiet terminal.

  Returns { status, latencyMs, lines, detail, pollTick } where status is
  'checking' | 'online' | 'unauthorized' | 'unreachable'. `/health/detailed`
  turns out to require the same bearer key as chat — discovered by testing
  against the real box with curl, not assumed up front. `detail` is the
  raw parsed response body while online (platforms, gateway_state,
  version, readiness checks — see components/chat/StatusPanel.jsx), or
  null otherwise; it's the same payload the status dot already samples,
  just no longer thrown away. `pollTick` increments on every completed
  poll attempt (success or failure) — the hero's SwarmCanvas bursts fire
  off this instead of a fake decorative timer (see components/Hero.jsx),
  so the "living" ambient animation is honestly tied to a real event.
*/
export function useGatewayHealth() {
  const [status, setStatus] = useState("checking");
  const [latencyMs, setLatencyMs] = useState(null);
  const [detail, setDetail] = useState(null);
  const [pollTick, setPollTick] = useState(0);
  const [lines, setLines] = useState([
    { t: stamp(), level: "info", text: `[UI]: booted, target ${GATEWAY_BASE_URL}` },
  ]);
  const mounted = useRef(true);

  const push = (level, text) => {
    if (!mounted.current) return;
    setLines((prev) => [...prev.slice(-(MAX_LINES - 1)), { t: stamp(), level, text }]);
  };

  useEffect(() => {
    mounted.current = true;
    let timer = null;

    async function poll() {
      const started = performance.now();
      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(`${GATEWAY_FETCH_BASE}/health/detailed`, {
          signal: controller.signal,
          mode: "cors",
          headers: GATEWAY_API_KEY ? { Authorization: `Bearer ${GATEWAY_API_KEY}` } : {},
        });
        clearTimeout(to);
        const ms = Math.round(performance.now() - started);
        if (!mounted.current) return;
        setLatencyMs(ms);
        if (res.ok) {
          setStatus("online");
          push("ok", `[Gateway]: health/detailed → ${res.status} (${ms}ms)`);
          res
            .json()
            .then((body) => {
              if (mounted.current) setDetail(body);
            })
            .catch(() => {
              /* status/latency already recorded — a malformed body just means no panel detail */
            });
        } else if (res.status === 401 || res.status === 403) {
          setStatus("unauthorized");
          setDetail(null);
          push("warn", `[Gateway]: health/detailed → ${res.status} (${ms}ms) — check VITE_GATEWAY_API_KEY`);
        } else {
          setStatus("unreachable");
          setDetail(null);
          push("warn", `[Gateway]: health/detailed → ${res.status} (${ms}ms)`);
        }
      } catch (err) {
        clearTimeout(to);
        if (!mounted.current) return;
        setStatus("unreachable");
        setLatencyMs(null);
        setDetail(null);
        const reason =
          err?.name === "AbortError"
            ? `no response within ${TIMEOUT_MS}ms`
            : "network error or CORS block";
        push("error", `[Gateway]: unreachable — ${reason}`);
      }
      if (mounted.current) {
        setPollTick((t) => t + 1);
        timer = setTimeout(poll, POLL_MS);
      }
    }

    poll();
    return () => {
      mounted.current = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return { status, latencyMs, lines, detail, pollTick, log: push };
}
