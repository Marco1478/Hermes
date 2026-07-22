import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import "./Accordion.css";

/*
  Accordion — a shared collapsible/dropdown section. Closed by default so
  dense pages (Missions especially) read as a compact list until you open
  what you actually want, instead of a wall of fully-expanded cards.
*/
export function Accordion({ title, meta, defaultOpen = false, children, className = "" }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`accordion ${open ? "accordion--open" : ""} ${className}`}>
      <button type="button" className="accordion-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <motion.span className="accordion-chevron" animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.18 }}>
          ›
        </motion.span>
        <span className="accordion-title">{title}</span>
        {meta && <span className="accordion-meta mono">{meta}</span>}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="accordion-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
          >
            <div className="accordion-body-inner">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
