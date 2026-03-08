"use client";

import { useEffect, useRef, useCallback } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";

interface Particle {
  x: number;
  y: number;
  tx: number;
  ty: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
}

const COLORS = ["#fa9277", "#ffece1", "#9dfa77", "#77dffa", "#d377fa", "#fafafa"];

// Seeded PRNG so server and client produce identical star positions
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const _r = seededRandom(42);
const STARS = Array.from({ length: 80 }, () => ({
  w: _r() > 0.9 ? 2 : 1,
  h: _r() > 0.9 ? 2 : 1,
  left: _r() * 100,
  top: _r() * 100,
  opacity: _r() * 0.4 + 0.1,
  dur: _r() * 3 + 2,
  delay: _r() * 3,
}));

const WORD_COLORS = ["#fa9277", "#9dfa77", "#77dffa", "#d377fa", "#ffece1"];

const WORD_TEXTS = [
  "PHOTOGRAPHERS",
  "VIDEOGRAPHERS",
  "MUSICIANS",
  "DESIGNERS",
  "WRITERS",
  "DEVELOPERS",
  "PRODUCERS",
  "ANIMATORS",
  "ILLUSTRATORS",
  "FILMMAKERS",
  "PODCASTERS",
  "CRAFTSMEN",
  "DREAMERS",
  "MAKERS",
];

// Seeded shuffle + randomized properties for deterministic SSR
const _rw = seededRandom(777);

// Fisher-Yates shuffle with seeded PRNG
const shuffled = [...WORD_TEXTS];
for (let i = shuffled.length - 1; i > 0; i--) {
  const j = Math.floor(_rw() * (i + 1));
  [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
}

const WORDS = shuffled.map((text, i) => {
  const zBase = -1500 - i * 800;                       // varied z spacing
  const zJitter = (_rw() - 0.5) * 400;                 // random z offset
  const x = (_rw() - 0.5) * 50;                        // -25vw to +25vw
  const y = (_rw() - 0.5) * 30;                        // -15vh to +15vh
  const scale = 0.6 + _rw() * 0.8;                     // 0.6x to 1.4x size
  const colorIdx = Math.floor(_rw() * WORD_COLORS.length);
  const colorShiftSpeed = 3 + _rw() * 7;               // 3s to 10s cycle
  const colorShiftDelay = _rw() * -10;                  // stagger the cycle
  return {
    text,
    x,
    y,
    z: zBase + zJitter,
    color: WORD_COLORS[colorIdx],
    scale,
    colorShiftSpeed,
    colorShiftDelay,
    // second color to shift toward
    color2: WORD_COLORS[(colorIdx + 1 + Math.floor(_rw() * (WORD_COLORS.length - 1))) % WORD_COLORS.length],
  };
});

export default function Scene1Arrival() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const mouse = useRef({ x: -9999, y: -9999 });
  const phase = useRef<"waiting" | "exploding" | "forming" | "idle">("waiting");
  const triggered = useRef(false);
  const pixelRef = useRef<HTMLDivElement>(null);
  const canvasLayerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const scrollPromptRef = useRef<HTMLDivElement>(null);

  // Force-set a canvas font at the given size, trying multiple formats.
  // Canvas c.font silently rejects invalid strings and stays at 10px default.
  const setCanvasFont = useCallback((c: CanvasRenderingContext2D, size: number, name: string) => {
    const tries = [
      `${size}px "${name}"`,
      `${size}px ${name}`,
      `400 ${size}px "${name}"`,
      `400 ${size}px ${name}`,
      `bold ${size}px Arial, sans-serif`,
      `${size}px sans-serif`,
    ];
    for (const t of tries) {
      c.font = t;
      // If it took, the font string won't start with "10px"
      if (!c.font.startsWith("10px")) return;
    }
  }, []);

  const sampleText = useCallback((w: number, h: number) => {
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const c = off.getContext("2d")!;

    c.fillStyle = "#fff";
    c.textAlign = "center";
    c.textBaseline = "middle";

    const s1 = Math.min(w / 7, 150);
    const s2 = s1 * 0.40;
    const lineGap = s1 * 0.35;

    const line1Y = h / 2 - lineGap / 2 - s2 * 0.3;
    const line2Y = h / 2 + s1 * 0.45 + lineGap / 2;

    setCanvasFont(c, s1, "Changa One");
    c.fillText("CREATOR SPACE", w / 2, line1Y);

    setCanvasFont(c, s2, "IBM Plex Mono");
    c.fillText("FORT WAYNE", w / 2, line2Y);

    const data = c.getImageData(0, 0, w, h).data;
    const pts: [number, number][] = [];
    const step = Math.max(3, Math.floor(Math.min(w, h) / 280));

    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        if (data[(y * w + x) * 4 + 3] > 128) {
          pts.push([x, y]);
        }
      }
    }
    return pts;
  }, [setCanvasFont]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    let cssW = 0;
    let cssH = 0;

    const init = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      cssW = rect.width || window.innerWidth;
      cssH = rect.height || window.innerHeight;
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const pts = sampleText(cssW, cssH);
      const count = Math.min(pts.length, 2800);
      particles.current = [];

      for (let i = 0; i < count; i++) {
        const [tx, ty] = pts[i % pts.length];
        particles.current.push({
          x: cssW / 2 + (Math.random() - 0.5) * 4,
          y: cssH / 2 + (Math.random() - 0.5) * 4,
          tx,
          ty,
          vx: 0,
          vy: 0,
          size: Math.random() * 1.8 + 0.5,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          alpha: 0,
        });
      }
    };

    const trigger = () => {
      if (triggered.current) return;
      triggered.current = true;
      phase.current = "exploding";

      if (pixelRef.current) pixelRef.current.style.opacity = "0";

      particles.current.forEach((p) => {
        const angle = Math.random() * Math.PI * 2;
        const force = Math.random() * 20 + 8;
        p.vx = Math.cos(angle) * force;
        p.vy = Math.sin(angle) * force;
        p.alpha = 1;
      });

      setTimeout(() => {
        phase.current = "forming";
      }, 600);
      setTimeout(() => {
        phase.current = "idle";
      }, 3500);
    };

    // Wait for next/font self-hosted fonts to be fully loaded
    const fontReady = async () => {
      await document.fonts.ready;
      // Poll until the display font is actually usable (up to 3s)
      const displayFont = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim();
      if (displayFont) {
        let attempts = 0;
        while (!document.fonts.check(`400 48px ${displayFont}`) && attempts < 30) {
          await new Promise((r) => setTimeout(r, 100));
          attempts++;
        }
      }
    };

    fontReady().then(() => {
      init();
      if (particles.current.length === 0) {
        // Retry — font may still be rendering
        setTimeout(() => { init(); if (particles.current.length > 0) trigger(); }, 500);
      } else {
        setTimeout(trigger, 2000);
      }
    });

    const onResize = () => fontReady().then(init);
    const onMouseMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
      trigger();
    };

    const loop = () => {
      if (cssW === 0) { raf = requestAnimationFrame(loop); return; }
      ctx.clearRect(0, 0, cssW, cssH);

      if (phase.current === "waiting") {
        raf = requestAnimationFrame(loop);
        return;
      }

      const mx = mouse.current.x;
      const my = mouse.current.y;

      for (const p of particles.current) {
        if (phase.current === "forming" || phase.current === "idle") {
          p.vx += (p.tx - p.x) * 0.025;
          p.vy += (p.ty - p.y) * 0.025;
        }

        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = dx * dx + dy * dy;
        if (dist < 16000) {
          const d = Math.sqrt(dist) || 1;
          const f = (130 - d) / 130;
          p.vx += (dx / d) * f * 5;
          p.vy += (dy / d) * f * 5;
        }

        p.vx *= 0.88;
        p.vy *= 0.88;
        p.x += p.vx;
        p.y += p.vy;

        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(loop);
    };

    loop();

    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMouseMove);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [sampleText]);

  // GSAP scroll animations: fly CREATOR SPACE through screen, fly camera through words
  useEffect(() => {
    if (!containerRef.current || !cameraRef.current || !canvasLayerRef.current) return;

    const ctx = gsap.context(() => {
      // Fly the CREATOR SPACE particle canvas toward/through the viewer
      // Scale it up massively so it zooms past, fade out once it's "behind" us
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: "25% top",
          scrub: 1,
        },
      });

      tl.to(canvasLayerRef.current, {
        scale: 12,
        opacity: 0,
        ease: "power1.in",
      });

      // Hide scroll prompt immediately on scroll
      gsap.to(scrollPromptRef.current, {
        opacity: 0,
        ease: "none",
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: "3% top",
          scrub: 0.5,
        },
      });

      // Fly camera through 3D word space — starts after CREATOR SPACE begins zooming
      const maxZ = Math.abs(WORDS[WORDS.length - 1].z) + 2000;
      gsap.fromTo(
        cameraRef.current,
        { z: 0 },
        {
          z: maxZ,
          ease: "none",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "15% top",
            end: "bottom bottom",
            scrub: 1.5,
          },
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="scene-arrival"
      ref={containerRef}
      className="relative bg-[var(--color-black)]"
      style={{ height: "400vh" }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* Star field */}
        <div className="absolute inset-0">
          {STARS.map((star, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                width: star.w,
                height: star.h,
                left: `${star.left}%`,
                top: `${star.top}%`,
                opacity: star.opacity,
                animation: `twinkle ${star.dur}s ease-in-out infinite`,
                animationDelay: `${star.delay}s`,
              }}
            />
          ))}
        </div>

        {/* 3D word fly-through space */}
        <div
          className="absolute inset-0"
          style={{ perspective: "900px" }}
        >
          <div
            ref={cameraRef}
            className="absolute inset-0"
            style={{ transformStyle: "preserve-3d" }}
          >
            {WORDS.map((w, i) => (
              <div
                key={`${w.text}-${i}`}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-[family-name:var(--font-display)]"
                style={{
                  transform: `translate3d(${w.x}vw, ${w.y}vh, ${w.z}px) scale(${w.scale})`,
                  fontSize: "clamp(2rem, 5vw, 5rem)",
                  animation: `color-shift-${i % 5} ${w.colorShiftSpeed}s ease-in-out infinite`,
                  animationDelay: `${w.colorShiftDelay}s`,
                  color: w.color,
                  textShadow: `0 0 40px ${w.color}60`,
                }}
              >
                {w.text}
              </div>
            ))}
          </div>
        </div>

        {/* Particle canvas layer (CREATOR SPACE text) - zooms through on scroll */}
        <div
          ref={canvasLayerRef}
          className="absolute inset-0 z-10 bg-[var(--color-black)]"
          style={{ transformOrigin: "center center", willChange: "transform, opacity" }}
        >
          {/* Pulsing pixel */}
          <div
            ref={pixelRef}
            className="pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-500"
          >
            <div
              className="h-1.5 w-1.5 rounded-full bg-white"
              style={{ animation: "pixel-pulse 2s ease-in-out infinite" }}
            />
          </div>
          {/* HTML text fallback — always visible behind transparent canvas */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <h1
                className="font-[family-name:var(--font-display)] text-white"
                style={{ fontSize: "min(calc(100vw / 7), 150px)", lineHeight: 1.1 }}
              >
                CREATOR SPACE
              </h1>
              <p
                className="font-[family-name:var(--font-mono)] text-white"
                style={{ fontSize: "min(calc(100vw / 17.5), 60px)", lineHeight: 1.2, marginTop: "0.3em" }}
              >
                FORT WAYNE
              </p>
            </div>
          </div>
          <canvas ref={canvasRef} className="absolute inset-0" />
        </div>

        {/* Scroll prompt */}
        <div
          ref={scrollPromptRef}
          className="absolute bottom-8 left-1/2 z-20 -translate-x-1/2 animate-bounce opacity-30"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-[var(--color-smoke)]"
          >
            <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
          </svg>
        </div>
      </div>
    </section>
  );
}
