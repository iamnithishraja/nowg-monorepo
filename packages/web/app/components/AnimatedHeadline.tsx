import { useEffect, useMemo, useRef, useState } from "react";

interface AnimatedHeadlineProps {
  lead?: string;
  words?: string[];
  cycleMs?: number;
  className?: string;
}

export default function AnimatedHeadline({
  lead = "Ship ideas",
  words = [
    "at speed of thought",
    "with AI",
    "together",
    "beautifully",
  ],
  cycleMs = 2600,
  className,
}: AnimatedHeadlineProps) {
  const safeWords = useMemo(() => (words.length ? words : ["faster"]), [words]);
  const [index, setIndex] = useState(0);
  const current = safeWords[index % safeWords.length];
  const [display, setDisplay] = useState("");
  const rafRef = useRef<number | null>(null);
  const stepRef = useRef(0);

  useEffect(() => {
    setDisplay("");
    stepRef.current = 0;

    const typeNext = () => {
      const nextStep = (stepRef.current ?? 0) + 1;
      stepRef.current = nextStep;
      setDisplay(current.slice(0, nextStep));

      if (nextStep >= current.length) {
        // Pause before cycling to the next word
        const timeout = window.setTimeout(() => setIndex((v) => v + 1), cycleMs);
        return () => window.clearTimeout(timeout);
      }

      // Use easing by alternating small/large frame gaps
      const base = 42; // base speed
      const ease = nextStep / current.length;
      const delay = base + Math.sin(ease * Math.PI) * 28; // natural easing

      const timeout = window.setTimeout(() => {
        rafRef.current = requestAnimationFrame(typeNext);
      }, delay);
      return () => window.clearTimeout(timeout);
    };

    rafRef.current = requestAnimationFrame(typeNext);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [current, cycleMs]);

  return (
    <h1 className={"text-balance font-semibold leading-tight " + (className ?? "") }>
      <span className="block text-white text-4xl md:text-5xl xl:text-6xl">
        {lead} <span className="sr-only">—</span>
      </span>
      <span className="relative mt-3 flex items-baseline gap-2 text-4xl md:text-5xl xl:text-6xl">
        <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(34,211,238,0.4)]">
          {display}
        </span>
        <span className="w-[2px] h-[1em] translate-y-[0.1em] bg-cyan-400 caret-blink rounded-sm shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
        <span className="absolute -bottom-1 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent opacity-60" />
      </span>
    </h1>
  );
}


