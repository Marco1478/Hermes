import { useEffect, useRef, useState } from "react";
import "./ParallaxGrid.css";

/*
  ParallaxGrid — a fine HUD grid that shifts with the cursor, and a
  coordinate readout in the corner. The readout is the cursor's own
  normalised position — real input, not decoration pretending to be data.
*/
export function ParallaxGrid({ active = true }) {
  const ref = useRef(null);
  const [coord, setCoord] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--px", (nx * 18).toFixed(2) + "px");
        el.style.setProperty("--py", (ny * 18).toFixed(2) + "px");
        setCoord({ x: nx, y: ny });
      });
    };
    const onLeave = () => {
      el.style.setProperty("--px", "0px");
      el.style.setProperty("--py", "0px");
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, [active]);

  return (
    <div className="hud-grid" ref={ref} aria-hidden="true">
      <p className="hud-coord hud-coord--tl mono">
        X {coord.x >= 0 ? "+" : ""}
        {coord.x.toFixed(3)}
      </p>
      <p className="hud-coord hud-coord--tr mono">
        Y {coord.y >= 0 ? "+" : ""}
        {coord.y.toFixed(3)}
      </p>
    </div>
  );
}
