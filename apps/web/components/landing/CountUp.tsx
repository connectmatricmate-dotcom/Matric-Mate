'use client';

/**
 * A number that counts up to its real value when it scrolls into view, in
 * step with the bars drawing beside it. Server-renders the final value, so
 * crawlers, no-JS visitors and reduced-motion users all read the true figure
 * with nothing owed to JavaScript.
 */
import { useEffect, useRef } from 'react';

export function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Same rule as Reveal: only animate what the visitor actually watches
    // arrive. Already on screen at load means stay put.
    if (el.getBoundingClientRect().top <= window.innerHeight * 0.9) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        const started = performance.now();
        const duration = 900;
        const tick = (now: number) => {
          const p = Math.min(1, (now - started) / duration);
          const eased = 1 - (1 - p) ** 3;
          el.textContent = String(Math.round(to * eased));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to]);

  return <span ref={ref}>{to}</span>;
}
