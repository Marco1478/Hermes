import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import "./SwarmCanvas.css";

const N_RING = 30;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Fixed ring size (fraction of the on-screen box) — deliberately NOT
   derived from the video's pixel spread. An earlier version measured
   luminance spread too, but hair strands + the glowing sphere she holds
   pulled it out to nearly the full frame width, which is the opposite of
   "a ring around the figure". Only the CENTRE is real, sampled data; the
   size is a tuned constant so the ring stays a tight, readable band. */
const RING_RX_FRAC = 0.21;
const RING_RY_FRAC = 0.24;

/* The raw luminance centroid skews upward (her face + hair are brighter
   than her chest/torso), which put the ring's back arc up near her head
   instead of circling her chest — clamped to the band that actually
   matches "around her upper body", per direct feedback with a reference
   circle drawn over a screenshot. X gets a small rightward nudge for the
   same reason (feedback: "keep it aligned", i.e. shifted right). */
const CENTRE_X_MIN = 0.5;
const CENTRE_X_MAX = 0.68;
const CENTRE_Y_MIN = 0.52;
const CENTRE_Y_MAX = 0.6;

/* Where the ring should actually go dark, in ring-local angle (radians;
   0 = right, PI/2 = front/bottom, PI = left, 3PI/2 = top): two narrow
   wedges — passing behind the sphere and behind her hair — not a whole
   hemisphere. Each wedge has a solid CORE (opacity truly 0, not just
   low — a linear ramp all the way to the centre left them faintly
   visible almost everywhere near the wedge) and a short transition band
   out to EDGE where they're back to fully visible. EDGE is wider than
   the first attempt so they duck out a bit sooner approaching each
   wedge. */
const OCCLUDE_SPHERE_ANGLE = Math.PI; // left
const OCCLUDE_HAIR_ANGLE = Math.PI * 1.55; // just past top, toward her face/hair
const OCCLUDE_CORE = 0.3; // radians (~17°) — fully invisible in here
const OCCLUDE_EDGE = 0.68; // radians (~39°) — fully visible past here

function angleDist(a, b) {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}

function ringOcclusion(angle) {
  const near = Math.min(angleDist(angle, OCCLUDE_SPHERE_ANGLE), angleDist(angle, OCCLUDE_HAIR_ANGLE));
  if (near <= OCCLUDE_CORE) return 0;
  if (near >= OCCLUDE_EDGE) return 1;
  return (near - OCCLUDE_CORE) / (OCCLUDE_EDGE - OCCLUDE_CORE);
}

/*
  sampleSubjectRegion — analyses the CURRENTLY VISIBLE video frame (i.e.
  already cropped exactly like the real <video>'s object-fit: cover, via
  the same source-rect math) to find where the illustrated figure
  actually sits: a luminance-weighted centroid over a small offscreen
  sample. Background is near-black, the figure/sphere are the brightest
  things in frame, so "bright mass" is a decent proxy for "the character"
  without needing real computer vision. Returns the centre as a fraction
  of the on-screen box (0..1) directly — no separate coordinate mapping
  needed at render time.
*/
function sampleSubjectRegion(video, W, H) {
  if (!video || !video.videoWidth || !W || !H) return null;
  const vw = video.videoWidth, vh = video.videoHeight;
  const scale = Math.max(W / vw, H / vh);
  const dispW = vw * scale, dispH = vh * scale;
  const offX = (W - dispW) / 2, offY = (H - dispH) / 2;
  const srcX = -offX / scale, srcY = -offY / scale, srcW = W / scale, srcH = H / scale;

  const sw = 64, sh = Math.max(1, Math.round((64 * H) / W));
  const off = document.createElement("canvas");
  off.width = sw;
  off.height = sh;
  const octx = off.getContext("2d", { willReadFrequently: true });
  try {
    octx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, sw, sh);
    const { data } = octx.getImageData(0, 0, sw, sh);
    const THRESH = 24;
    let sumL = 0, sumX = 0, sumY = 0;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const i = (y * sw + x) * 4;
        const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (l > THRESH) {
          const w = l - THRESH;
          sumL += w;
          sumX += x * w;
          sumY += y * w;
        }
      }
    }
    if (sumL < 1) return null;
    const rawCxFrac = sumX / sumL / sw;
    const rawCyFrac = sumY / sumL / sh;
    return {
      cxFrac: Math.min(CENTRE_X_MAX, Math.max(CENTRE_X_MIN, rawCxFrac + 0.05)),
      cyFrac: Math.min(CENTRE_Y_MAX, Math.max(CENTRE_Y_MIN, rawCyFrac + 0.1)),
      rxFrac: RING_RX_FRAC,
      ryFrac: RING_RY_FRAC,
    };
  } catch {
    return null;
  }
}

/* Glowing-dot look for each ring particle: a radial-gradient glow, a
   small rotating faceted (hexagon) core echoing a gem cut, and — above a
   visibility threshold — an 8-ray sparkle. */
function drawParticle(ctx, x, y, radius, alpha, warm, sparkleRot, extraFlare = 0) {
  if (alpha < 0.03) return;
  const glow = warm ? "255, 214, 165" : "200, 224, 255";
  const core = warm ? "255, 240, 220" : "220, 236, 255";

  const glowR = radius * 4.2;
  const grad = ctx.createRadialGradient(x, y, 0, x, y, glowR);
  grad.addColorStop(0, `rgba(${glow}, ${(alpha * 0.5).toFixed(3)})`);
  grad.addColorStop(0.45, `rgba(${glow}, ${(alpha * 0.16).toFixed(3)})`);
  grad.addColorStop(1, `rgba(${glow}, 0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, glowR, 0, Math.PI * 2);
  ctx.fill();

  const facetR = radius * 1.15;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sparkleRot);
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const px = Math.cos(a) * facetR, py = Math.sin(a) * facetR;
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, facetR);
  coreGrad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(1, alpha + 0.25).toFixed(3)})`);
  coreGrad.addColorStop(1, `rgba(${core}, ${(alpha * 0.75).toFixed(3)})`);
  ctx.fillStyle = coreGrad;
  ctx.fill();
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = `rgba(255, 255, 255, ${(alpha * 0.6).toFixed(3)})`;
  ctx.stroke();
  ctx.restore();

  if (alpha > 0.2) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(sparkleRot);
    ctx.lineCap = "round";
    const mainLen = radius * (3.2 + extraFlare * 2);
    ctx.globalAlpha = alpha * 0.6;
    ctx.strokeStyle = "rgba(255, 255, 255, 1)";
    ctx.lineWidth = Math.max(0.4, radius * 0.2);
    ctx.beginPath();
    ctx.moveTo(-mainLen, 0);
    ctx.lineTo(mainLen, 0);
    ctx.moveTo(0, -mainLen);
    ctx.lineTo(0, mainLen);
    ctx.stroke();

    const diagLen = mainLen * 0.5;
    ctx.rotate(Math.PI / 4);
    ctx.globalAlpha = alpha * 0.32;
    ctx.lineWidth = Math.max(0.3, radius * 0.12);
    ctx.beginPath();
    ctx.moveTo(-diagLen, 0);
    ctx.lineTo(diagLen, 0);
    ctx.moveTo(0, -diagLen);
    ctx.lineTo(0, diagLen);
    ctx.stroke();
    ctx.restore();
  }
}

/*
  SwarmCanvas — a ring of glowing-dot particles circling her upper body,
  centred on a real luminance-sampled position (see sampleSubjectRegion).
  All particles share one rotation (evenly spaced, turning together) so
  they read as a coherent ring, not a drifting cloud. They go fully dark
  only in two narrow wedges — passing behind the sphere and behind her
  hair (see ringOcclusion) — everywhere else they stay lit.

  trigger() — called on a real event (see Hero.jsx, fired off actual
  gateway health polls) — briefly boosts a couple of particles.
*/
export const SwarmCanvas = forwardRef(function SwarmCanvas({ videoRef }, ref) {
  const canvasRef = useRef(null);
  const flaresRef = useRef([]); /* { idx, t0 } */
  const subjectRef = useRef({ cxFrac: 0.6, cyFrac: 0.42, rxFrac: RING_RX_FRAC, ryFrac: RING_RY_FRAC });

  const ringRef = useRef(
    (() => {
      const rand = mulberry32(0x5377726d);
      const nodes = [];
      for (let i = 0; i < N_RING; i++) {
        nodes.push({
          baseAngle: (i / N_RING) * Math.PI * 2 + (rand() - 0.5) * (Math.PI / N_RING) * 0.6,
          radiusJitter: 1 + (rand() - 0.5) * 0.16,
          wobble: rand() * Math.PI * 2,
          wobbleSpeed: 0.2 + rand() * 0.3,
          r: 1.8 + rand() * 2,
          sparkleRot: rand() * Math.PI * 2,
          spinSpeed: (rand() - 0.5) * 0.6,
          warm: rand() < 0.22,
        });
      }
      return nodes;
    })()
  );

  useImperativeHandle(ref, () => ({
    trigger(count = 2) {
      const nodes = ringRef.current;
      if (!nodes.length) return;
      const now = performance.now();
      const picked = new Set();
      while (picked.size < Math.min(count, nodes.length)) {
        picked.add((Math.random() * nodes.length) | 0);
      }
      for (const idx of picked) flaresRef.current.push({ idx, t0: now });
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, dpr = 1;
    let raf = 0;

    function resample() {
      const video = videoRef?.current;
      const region = sampleSubjectRegion(video, W, H);
      if (region) subjectRef.current = region;
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width; H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      resample();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const video = videoRef?.current;
    const onLoaded = () => {
      setTimeout(resample, 200);
      setTimeout(resample, 1200);
    };
    video?.addEventListener("loadeddata", onLoaded);
    if (video?.readyState >= 2) onLoaded();

    const ROT_SPEED = 0.11; /* rad/s, shared by every particle — one coherent ring */
    let last = performance.now();
    let rot = 0;
    function frame(now) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      rot += dt * ROT_SPEED;
      if (!W || !H) { raf = requestAnimationFrame(frame); return; }
      ctx.clearRect(0, 0, W, H);

      const { cxFrac, cyFrac, rxFrac, ryFrac } = subjectRef.current;
      const cx = cxFrac * W, cy = cyFrac * H;
      const orbitRx = rxFrac * W, orbitRy = ryFrac * H;

      const flares = flaresRef.current;
      const flareIdx = new Map();
      for (let k = flares.length - 1; k >= 0; k--) {
        const f = flares[k];
        const age = (now - f.t0) / 1000;
        const life = 1.3;
        if (age > life) { flares.splice(k, 1); continue; }
        flareIdx.set(f.idx, Math.sin(Math.min(1, age / life) * Math.PI));
      }

      const nodes = ringRef.current;
      const order = nodes
        .map((p, i) => ({ i, angle: p.baseAngle + rot }))
        .sort((a, b) => Math.sin(a.angle) - Math.sin(b.angle));

      for (const { i, angle } of order) {
        const p = nodes[i];
        const depth = Math.sin(angle);
        const wob = 1 + Math.sin(now * 0.001 * p.wobbleSpeed + p.wobble) * 0.02;
        const rx = orbitRx * p.radiusJitter * wob;
        const ry = orbitRy * p.radiusJitter * wob;
        const x = cx + Math.cos(angle) * rx;
        const y = cy + depth * ry;

        /* Mostly-visible ring, only dipping near the two occlusion
           wedges (sphere / hair) — see ringOcclusion, which now has a
           real zero-opacity core, not just a dip. A gentle depth shade
           on top keeps a little roundness without hiding a whole
           hemisphere like the first version did. */
        const occl = ringOcclusion(angle);
        const gentle = 0.55 + 0.45 * ((depth + 1) / 2);
        const flare = flareIdx.get(i) || 0;
        const alpha = occl <= 0 ? 0 : Math.min(1, gentle * occl + flare * 0.55 * occl);
        if (alpha < 0.03) continue;

        const scale = 0.6 + 0.6 * occl + flare * 0.5;
        const facetRot = p.sparkleRot + now * 0.00035 * p.spinSpeed;
        drawParticle(ctx, x, y, p.r * scale, alpha, p.warm, facetRot, flare);
      }

      raf = requestAnimationFrame(frame);
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      video?.removeEventListener("loadeddata", onLoaded);
    };
  }, [videoRef]);

  return <canvas ref={canvasRef} className="hud-swarm" aria-hidden="true" />;
});
