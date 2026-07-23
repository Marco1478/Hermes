import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import "./Toast.css";

/*
  Toast — a small, generic "something just happened" notice, built for
  Canvas's CLAUDE-007 micro-feedback pass but deliberately not Canvas-
  specific: any component can call useToasts() and drop <ToastStack/>
  somewhere in its tree. No context/provider — each caller owns its own
  queue, which is enough for a single surface like Canvas and avoids
  wiring a global provider into App for a feature that's only used in one
  place today.
*/
let nextToastId = 0;

export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message, { tone = "info", duration = 2400 } = {}) => {
      const id = ++nextToastId;
      setToasts((t) => [...t, { id, message, tone }]);
      if (duration) {
        const timer = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss]
  );

  return { toasts, push, dismiss };
}

export function ToastStack({ toasts, onDismiss, className }) {
  return (
    <div className={`toast-stack${className ? ` ${className}` : ""}`}>
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className={`toast toast--${t.tone}`}
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            onClick={() => onDismiss(t.id)}
          >
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
