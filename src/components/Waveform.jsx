import { useEffect, useRef } from "react";
import "./Waveform.css";

/*
  Waveform — a thin line at the foot of the hero. Idle, it breathes like
  slow respiration (a single low-frequency envelope). Passing `active`
  (wire this to real voice-input state later) speeds it up and widens the
  amplitude, standing in for audio-reactivity until a real mic analyser
  is connected.
*/
export function Waveform({ active = false }) {
  const canvasRef = useRef(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let raf = 0;
    let t = 0;
    let W = 0, H = 0, dpr = 1;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width;
      H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    function draw() {
      if (!W || !H) { raf = requestAnimationFrame(draw); return; }
      ctx.clearRect(0, 0, W, H);
      const busy = activeRef.current;
      const breath = busy ? 1 : 0.42 + 0.28 * Math.sin(t * 0.6);
      const freq = busy ? 0.055 : 0.02;
      const speed = busy ? 2.6 : 0.9;
      const N = 140;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const x = (i / N) * W;
        const n = i / N - 0.5;
        const taper = Math.cos(n * Math.PI) ** 1.4; /* fades at both ends */
        const y =
          H / 2 +
          Math.sin(i * freq + t * speed) * (H * 0.34) * breath * taper +
          Math.sin(i * freq * 2.7 + t * speed * 1.4) * (H * 0.12) * breath * taper;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = busy
        ? "rgba(191, 224, 255, 0.85)"
        : "rgba(198, 201, 208, 0.42)";
      ctx.lineWidth = busy ? 1.6 : 1.1;
      ctx.shadowColor = busy ? "rgba(150, 200, 255, 0.6)" : "transparent";
      ctx.shadowBlur = busy ? 6 : 0;
      ctx.stroke();
      t += 0.016;
      raf = requestAnimationFrame(draw);
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) raf = requestAnimationFrame(draw);
    else { resize(); draw(); cancelAnimationFrame(raf); }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="hud-waveform" aria-hidden="true" />;
}
