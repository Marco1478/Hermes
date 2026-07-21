import { useEffect, useRef, useState } from "react";
import { BrandMark } from "./BrandMark.jsx";
import { HeroSidebar } from "./hero/HeroSidebar.jsx";
import { ParallaxGrid } from "./ParallaxGrid.jsx";
import { Waveform } from "./Waveform.jsx";
import { SwarmCanvas } from "./SwarmCanvas.jsx";
import { ConsciousnessTerminal } from "./ConsciousnessTerminal.jsx";
import { CommandBar } from "./CommandBar.jsx";
import { useGateway } from "../state/GatewayHealth.jsx";
import { GATEWAY_BASE_URL } from "../config.js";
import "./Hero.css";

export function Hero() {
  const videoRef = useRef(null);
  const swarmRef = useRef(null);
  const [ready, setReady] = useState(false);
  const gateway = useGateway();

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onReady = () => setReady(true);
    v.addEventListener("loadeddata", onReady);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      v.pause();
    } else {
      v.play().catch(() => {
        const resume = () => {
          v.play().catch(() => {});
          window.removeEventListener("pointerdown", resume);
        };
        window.addEventListener("pointerdown", resume, { once: true });
      });
    }
    return () => v.removeEventListener("loadeddata", onReady);
  }, []);

  /* Swarm flares fire on real gateway health polls (every ~8s, see
     useGatewayHealth) instead of a decorative fake timer — pollTick===0
     is the pre-first-poll render, skipped so nothing fires before a real
     poll has actually happened. A single dim flare on unreachable still
     reads as "something just happened", not "all is well". */
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || gateway.pollTick === 0) return;
    swarmRef.current?.trigger(gateway.status === "online" ? 2 : 1);
  }, [gateway.pollTick, gateway.status]);

  return (
    <section className="hero">
      <div className="hero-video-frame">
        <video
          ref={videoRef}
          className={`hero-video${ready ? " hero-video--ready" : ""}`}
          src="/hermes-background.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        />
      </div>
      <div className="hero-scrim" aria-hidden="true" />

      {/* Must paint AFTER the video+scrim (DOM order = paint order at the
          z-index:auto/0 level they share) — it was previously first in
          the tree, so the opaque video sat right on top and hid it
          completely. videoRef lets it sample the actual visible frame to
          find where the figure sits (see SwarmCanvas.jsx), instead of a
          guessed fixed position. */}
      <SwarmCanvas ref={swarmRef} videoRef={videoRef} />

      <ParallaxGrid />
      <Waveform />

      {/* Logo / home button, top-left */}
      <BrandMark />

      {/* Left column: usage rings, system/messaging stats, sessions —
          three glass cards distributed down the height instead of a
          cluster of floating text. */}
      <HeroSidebar />

      {/* Identity block — quiet, bottom-left */}
      <header className="hero-id">
        <h1 className="hero-wordmark">Hermes</h1>
        <p className="hero-sub">The agent at home. Always on.</p>
        <p className="hero-status mono" role="status">
          <span className="led led--pulse" aria-hidden="true" />
          AGENT · LISTENING
        </p>
      </header>

      {/* Node address — quiet, bottom-right */}
      <p className="hero-node mono" aria-hidden="true">
        GATEWAY {GATEWAY_BASE_URL.replace(/^https?:\/\//, "")} · {gateway.status.toUpperCase()}
      </p>

      <ConsciousnessTerminal lines={gateway.lines} status={gateway.status} />
      <CommandBar />
    </section>
  );
}
