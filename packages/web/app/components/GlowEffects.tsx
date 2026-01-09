import { animate } from "motion";
import { useEffect, useRef } from "react";

export default function GlowEffects() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const bands = el.querySelectorAll("[data-band]");
    bands.forEach((band, i) => {
      const x = i % 2 === 0 ? ["-5%", "5%", "-7%"] : ["7%", "-3%", "7%"];
      const y = i % 3 === 0 ? ["-3%", "3%", "-5%"] : ["5%", "-2%", "5%"];
      animate(
        band as Element,
        { x, y },
        { duration: 30 + i * 5, repeat: Infinity }
      );
    });
  }, []);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-5 overflow-hidden"
    >
      {/* Animated glow bands */}
      <div
        data-band
        className="absolute left-0 top-1/4 h-[40rem] w-[80rem] rotate-[12deg] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(50% 60% at 50% 50%, rgba(34, 197, 94, 0.08) 0%, rgba(34, 197, 94, 0.06) 45%, rgba(34, 197, 94, 0.04) 100%)",
          mixBlendMode: "screen",
          willChange: "transform",
        }}
      />
      <div
        data-band
        className="absolute right-0 top-1/2 h-[36rem] w-[70rem] -rotate-[8deg] rounded-full blur-[70px]"
        style={{
          background:
            "radial-gradient(55% 65% at 50% 50%, rgba(34, 197, 94, 0.06) 0%, rgba(34, 197, 94, 0.04) 50%, rgba(34, 197, 94, 0.02) 100%)",
          mixBlendMode: "screen",
          willChange: "transform",
        }}
      />
      <div
        data-band
        className="absolute left-1/4 top-0 h-[32rem] w-[60rem] rotate-[22deg] rounded-full blur-[60px]"
        style={{
          background:
            "radial-gradient(60% 70% at 50% 50%, rgba(34, 197, 94, 0.05) 0%, rgba(34, 197, 94, 0.03) 50%, rgba(34, 197, 94, 0.01) 100%)",
          mixBlendMode: "screen",
          willChange: "transform",
        }}
      />
    </div>
  );
}
