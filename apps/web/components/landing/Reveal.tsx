'use client';

/**
 * Scroll-reveal wrapper for the marketing pages. Works by REMOVING a class:
 * on mount it marks only elements still below the viewport as .rv-wait
 * (hidden), then lifts the mark when they scroll into view. Everything else,
 * no-JS visitors, crawlers, content already on screen, a bundle that never
 * arrives, stays visible the whole time. The look lives in globals.css under
 * "Landing-page motion system".
 */
import { useEffect, useRef } from 'react';

export function Reveal({
  children,
  className = '',
  as: As = 'div',
  stagger,
}: {
  children: React.ReactNode;
  className?: string;
  /** Rendered element. Sections and list wrappers are all this needs. */
  as?: 'div' | 'section' | 'ol' | 'ul';
  /** Animate the children one by one instead of the wrapper as a block. */
  stagger?: boolean;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // On screen already (or nearly): leave it alone. Hiding it now would
    // flash, and an entrance the visitor cannot see communicates nothing.
    if (el.getBoundingClientRect().top <= window.innerHeight * 0.9) return;

    el.classList.add('rv-wait');
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.remove('rv-wait');
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      el.classList.remove('rv-wait');
    };
  }, []);

  return (
    <As
      ref={ref as React.Ref<never>}
      className={`rv ${stagger ? 'rv-stagger' : ''} ${className}`}
    >
      {children}
    </As>
  );
}
