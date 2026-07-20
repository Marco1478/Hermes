import { GATEWAY_FETCH_BASE, GATEWAY_API_KEY } from "../config.js";

/*
  gatewayRuns — the real backend for Chat. Talks to Hermes's async Runs
  API (discovered by live probing, not documented anywhere we could
  find):

    POST /v1/runs {input, session_id?}  -> 202 {run_id, status:"started"}
    GET  /v1/runs/{id}/events           -> SSE: tool.started, tool.completed,
                                            message.delta, reasoning.available,
                                            run.completed / run.cancelled / run.failed
    GET  /v1/runs/{id}                  -> polling fallback; terminal states
                                            carry "output" (full text) + "usage"
    POST /v1/runs/{id}/stop             -> cancels a running run

  session_id: omit it and Hermes assigns a fresh one equal to the run_id
  (verified live) — that's what "new session" means here. Pass a prior
  run's session_id to continue that thread. Hermes's persistent memory
  is independent of session_id — a fresh session still recalls facts,
  by design; only the raw conversation thread resets.
*/

function authHeaders() {
  if (!GATEWAY_API_KEY) {
    throw new Error(
      "No gateway API key configured. Copy .env.local.example to .env.local, set VITE_GATEWAY_API_KEY, and restart the dev server."
    );
  }
  return { Authorization: `Bearer ${GATEWAY_API_KEY}` };
}

async function readError(res, fallbackMsg) {
  const raw = await res.text().catch(() => "");
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    /* non-JSON body */
  }
  const detail = data?.error?.message || data?.message || raw.slice(0, 300) || fallbackMsg;
  return Object.assign(new Error(detail), { status: res.status, raw });
}

/* Starts a run. Returns { runId, sessionId }. sessionId is the run's own
   id when none was supplied — Hermes always reports it back via the
   GET/events path, but we don't need to wait for that: same-run-id
   default is confirmed behaviour, so we can use runId synchronously and
   correct it later if a session_id was explicitly passed in. */
export async function createRun(input, sessionId, options = {}) {
  const { model, attachments } = options;
  const body = { input };
  if (sessionId) body.session_id = sessionId;
  if (model) body.model = model;
  if (attachments && attachments.length) body.attachments = attachments;
  const res = await fetch(`${GATEWAY_FETCH_BASE}/v1/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (res.status !== 202) throw await readError(res, `HTTP ${res.status}`);
  const data = await res.json();
  return { runId: data.run_id, sessionId: sessionId || data.run_id };
}

export async function stopRun(runId) {
  const res = await fetch(`${GATEWAY_FETCH_BASE}/v1/runs/${runId}/stop`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw await readError(res, `HTTP ${res.status}`);
  return res.json();
}

export async function getRun(runId) {
  const res = await fetch(`${GATEWAY_FETCH_BASE}/v1/runs/${runId}`, { headers: authHeaders() });
  if (!res.ok) throw await readError(res, `HTTP ${res.status}`);
  return res.json();
}

const TERMINAL = new Set(["completed", "failed", "error", "cancelled"]);

/*
  subscribeRunEvents — opens the SSE stream and calls back into
  `handlers` as events arrive. Returns an abort() function (also used
  internally when a terminal event closes the stream on its own).

  handlers: { onDelta(text), onTool({phase:'start'|'end', tool, error?}),
              onReasoning(text), onDone({status, output, usage}),
              onError(err) }
*/
export function subscribeRunEvents(runId, handlers) {
  const controller = new AbortController();

  (async () => {
    let res;
    try {
      res = await fetch(`${GATEWAY_FETCH_BASE}/v1/runs/${runId}/events`, {
        headers: authHeaders(),
        signal: controller.signal,
      });
    } catch (err) {
      if (err.name !== "AbortError") handlers.onError?.(err);
      return;
    }
    if (!res.ok || !res.body) {
      handlers.onError?.(await readError(res, `HTTP ${res.status}`));
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const chunks = buf.split("\n\n");
        buf = chunks.pop();
        for (const chunk of chunks) {
          const line = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          let evt;
          try {
            evt = JSON.parse(line.slice(6));
          } catch {
            continue;
          }
          switch (evt.event) {
            case "message.delta":
              handlers.onDelta?.(evt.delta ?? "");
              break;
            case "tool.started":
              handlers.onTool?.({ phase: "start", tool: evt.tool, preview: evt.preview });
              break;
            case "tool.completed":
              handlers.onTool?.({ phase: "end", tool: evt.tool, duration: evt.duration, error: evt.error });
              break;
            case "reasoning.available":
              handlers.onReasoning?.(evt.text ?? "");
              break;
            case "run.completed":
              handlers.onDone?.({ status: "completed", output: evt.output, usage: evt.usage });
              return;
            case "run.cancelled":
              handlers.onDone?.({ status: "cancelled", output: evt.output ?? null, usage: evt.usage });
              return;
            case "run.failed":
            case "run.error":
              handlers.onDone?.({ status: "failed", output: evt.output ?? null, error: evt.error });
              return;
            default:
              /* unknown event type — ignore rather than break the stream */
              break;
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") handlers.onError?.(err);
    }
  })();

  return () => controller.abort();
}

export function isTerminalStatus(status) {
  return TERMINAL.has(status);
}
