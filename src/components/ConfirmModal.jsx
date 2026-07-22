import { motion } from "framer-motion";
import { GlassButton } from "./ui/GlassButton.jsx";

/*
  ConfirmModal — the one shared dangerous/state-changing action confirm
  dialog. Used by the Safety Center (approve/revoke/clear-pending) and the
  command palette's confirm step; intended as the default for any future
  destructive control instead of a fresh window.confirm() each time.
*/
export function ConfirmModal({ title, detail, confirmLabel = "confirm", danger = true, busy, onCancel, onConfirm }) {
  return (
    <motion.div className="job-modal-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
      <motion.div
        className="glass-card job-modal"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: "spring", stiffness: 460, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-label={title}
      >
        <p className="panel-section-title">{title}</p>
        {detail && <p className={danger ? "panel-error" : "panel-empty"}>{detail}</p>}
        <div className="job-modal-actions">
          <GlassButton variant="secondary" onClick={onCancel} disabled={busy}>
            cancel
          </GlassButton>
          <GlassButton variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={busy}>
            {busy ? "working…" : confirmLabel}
          </GlassButton>
        </div>
      </motion.div>
    </motion.div>
  );
}
