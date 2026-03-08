"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";

export default function Scene3Landing() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const turbulenceRef = useRef<SVGFETurbulenceElement>(null);

  useEffect(() => {
    // Liquid distortion animation
    const turbulence = turbulenceRef.current;
    if (!turbulence) return;
    let frame = 0;
    let raf: number;
    const animate = () => {
      frame += 0.004;
      turbulence.setAttribute(
        "baseFrequency",
        `${0.015 + Math.sin(frame) * 0.008} ${0.03 + Math.cos(frame) * 0.006}`
      );
      raf = requestAnimationFrame(animate);
    };
    animate();

    // Scroll-triggered text entrance
    if (sectionRef.current) {
      const ctx = gsap.context(() => {
        gsap.from(".landing-text", {
          y: 60,
          opacity: 0,
          stagger: 0.15,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 60%",
            toggleActions: "play none none none",
          },
        });
      }, sectionRef);
      return () => {
        cancelAnimationFrame(raf);
        ctx.revert();
      };
    }

    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section
      id="scene-landing"
      ref={sectionRef}
      className="relative z-10 flex items-center justify-center overflow-x-hidden bg-[var(--color-black)] py-24 sm:py-32"
      style={{ marginTop: "-50vh" }}
    >
      {/* Violet animated gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, #0a0a0a 0%, #1e1e1e 20%, #d377fa18 45%, #b85de015 65%, #0a0a0a 100%)",
          backgroundSize: "400% 400%",
          animation: "gradient-shift 15s ease infinite",
        }}
      />
      {/* Noise overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        }}
      />

      {/* SVG liquid filter */}
      <svg className="absolute h-0 w-0" aria-hidden="true">
        <defs>
          <filter id="liquid-distortion">
            <feTurbulence
              ref={turbulenceRef}
              type="fractalNoise"
              baseFrequency="0.015 0.03"
              numOctaves="3"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="14"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <div className="relative z-10 px-6 text-center">
        <div className="landing-text font-[family-name:var(--font-display)] text-5xl leading-[1.1] sm:text-7xl md:text-8xl lg:text-9xl">
          {[["FREE", "MONTHLY"], ["MEETUPS", "FOR"], ["FORT", "WAYNE"]].map((line, li) => (
            <p key={li}>
              {line.map((word, wi) => (
                <span key={word}>
                  <span
                    className="inline-block cursor-default transition-colors duration-300"
                    style={{
                      color: "transparent",
                      WebkitTextStroke: "2px var(--color-white)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "var(--color-white)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "transparent";
                    }}
                  >
                    {word}
                  </span>
                  {wi < line.length - 1 && " "}
                </span>
              ))}
            </p>
          ))}
        </div>
        <p
          className="landing-text mt-2 font-[family-name:var(--font-display)] text-6xl leading-[1.1] text-[var(--color-coral)] sm:text-8xl md:text-9xl lg:text-[11rem]"
          style={{ filter: "url(#liquid-distortion)" }}
        >
          CREATORS
        </p>
        <p className="landing-text mt-10 font-[family-name:var(--font-mono)] text-sm tracking-widest text-[var(--color-mist)] sm:text-base">
          Meet. Share. Grow.
        </p>
      </div>
    </section>
  );
}
