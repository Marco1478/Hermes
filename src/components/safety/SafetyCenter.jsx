import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { fetchPairing, approvePairing, revokePairing, clearPendingPairing, fetchDashboardStatus } from "../../lib/hermesBridge.js";
import { PageShell } from "../PageShell.jsx";
import { DiagnosticCard } from "../DiagnosticCard.jsx";
import { ConfirmModal } from "../ConfirmModal.jsx";
import "./SafetyCenter.css";

/*
  SafetyCenter — pending/approved DM pairing requests, the one real
  "approve or deny before a stranger can talk to Hermes" surface this build
  actually exposes (GET/POST /api/pairing*, verified against
  web_server.py). There's no generic "approve this dangerous tool call"
  queue on this build — that's a separate, unbuilt capability, named here
  rather than faked.
*/
export function SafetyCenter() {
  const [dashStatus, setDashStatus] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind, payload }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const st = await fetchDashboardStatus();
      setDashStatus(st);
      if (!st.configured) return;
      const res = await fetchPairing();
      setData(res);
      setError(null);
    } catch (err) {
      setError(err.message || String(err));
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [load]);

  async function runConfirmed() {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.kind === "approve") await approvePairing(confirm.payload.platform, confirm.payload.code);
      else if (confirm.kind === "revoke") await revokePairing(confirm.payload.platform, confirm.payload.user_id);
      else if (confirm.kind === "clear-pending") await clearPendingPairing();
      setConfirm(null);
      await load();
    } catch (err) {
      setError(err.message || String(err));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title="Safety">
      {dashStatus && !dashStatus.configured && (
        <DiagnosticCard
          title="Dashboard not configured"
          detail="Pairing approvals live on the dashboard bridge, same as everything else that needs a session cookie."
          hint="Set HERMES_DASHBOARD_BASE_URL/USERNAME/PASSWORD in .env.local."
        />
      )}
      {error && <DiagnosticCard title="Pairing data unavailable" detail={error} />}

      {dashStatus?.configured && !error && (
        <>
          <div className="panel-section">
            <div className="safety-section-head">
              <p className="panel-section-title">Pending pairing requests</p>
              {data?.pending?.length > 0 && (
                <button type="button" className="btn-pill btn-pill--danger" onClick={() => setConfirm({ kind: "clear-pending" })}>
                  clear all pending
                </button>
              )}
            </div>
            {!data && <p className="panel-empty">Loading…</p>}
            {data?.pending?.length === 0 && <p className="panel-empty">No pending pairing requests — nobody's waiting to be let in.</p>}
            <div className="safety-list">
              {data?.pending?.map((p, i) => (
                <div key={i} className="panel-card safety-row">
                  <div className="safety-row-body">
                    <span className="safety-row-title">{p.platform || "unknown platform"}</span>
                    <span className="safety-row-meta mono">code {p.code || "—"} · requested {p.created_at || p.requested_at || "—"}</span>
                  </div>
                  <button type="button" className="btn-pill" onClick={() => setConfirm({ kind: "approve", payload: p })}>
                    approve
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="panel-section">
            <p className="panel-section-title">Approved users</p>
            {data?.approved?.length === 0 && <p className="panel-empty">No approved users yet.</p>}
            <div className="safety-list">
              {data?.approved?.map((a, i) => (
                <div key={i} className="panel-card safety-row">
                  <div className="safety-row-body">
                    <span className="safety-row-title">{a.platform || "unknown platform"}</span>
                    <span className="safety-row-meta mono">user {a.user_id || "—"} · approved {a.approved_at || "—"}</span>
                  </div>
                  <button type="button" className="btn-pill btn-pill--danger" onClick={() => setConfirm({ kind: "revoke", payload: a })}>
                    revoke
                  </button>
                </div>
              ))}
            </div>
          </div>

          <DiagnosticCard
            tone="warn"
            title="No generic dangerous-command approval queue on this build"
            detail="/approve and /deny in Telegram refer to DM pairing, not a per-tool-call approval queue — no such endpoint exists in web_server.py to surface here."
          />
        </>
      )}

      <AnimatePresence>
        {confirm && (
          <ConfirmModal
            title={confirm.kind === "clear-pending" ? "Clear all pending requests?" : confirm.kind === "approve" ? "Approve pairing?" : "Revoke access?"}
            detail={
              confirm.kind === "clear-pending"
                ? "Every pending code is discarded — requesters will need to ask again."
                : confirm.kind === "approve"
                  ? `${confirm.payload.platform} code ${confirm.payload.code} will be able to message Hermes.`
                  : `${confirm.payload.platform} user ${confirm.payload.user_id} loses access immediately.`
            }
            confirmLabel={confirm.kind === "approve" ? "approve" : confirm.kind === "revoke" ? "revoke" : "clear"}
            danger={confirm.kind !== "approve"}
            busy={busy}
            onCancel={() => setConfirm(null)}
            onConfirm={runConfirmed}
          />
        )}
      </AnimatePresence>
    </PageShell>
  );
}
