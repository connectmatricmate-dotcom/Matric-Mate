'use client';

/**
 * A soft light that trails the pointer across the landing page.
 *
 * It writes two custom properties on one fixed element and lets CSS do the
 * rest, so nothing here triggers layout. Position is eased toward the pointer
 * on an animation frame rather than snapped to it, which is the difference
 * between "a circle stuck to the cursor" and a light that feels like it has
 * weight.
 *
 * Skipped entirely on touch screens, where there is no pointer, and under
 * prefers-reduced-motion. The frame loop runs only while the light is still
 * catching up with the pointer: it used to run sixty times a second for as
 * long as the page was open, cursor moving or not.
 */
import { useEffect, useRef } from 'react';

export function CursorGlow() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Start centred so the first frame does not fly in from the corner.
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let tx = x;
    let ty = y;
    let frame = 0;

    const tick = () => {
      // 0.12 is the follow weight: low enough to lag visibly, high enough
      // that it never feels like it is stuck behind the cursor.
      x += (tx - x) * 0.12;
      y += (ty - y) * 0.12;
      el.style.setProperty('--gx', `${x.toFixed(1)}px`);
      el.style.setProperty('--gy', `${y.toFixed(1)}px`);
      // Within half a pixel is arrived: stop until the pointer moves again.
      frame = Math.abs(tx - x) > 0.5 || Math.abs(ty - y) > 0.5 ? requestAnimationFrame(tick) : 0;
    };

    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      el.classList.add('on');
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const onLeave = () => el.classList.remove('on');

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  // data-chrome: a fixed decoration, which has no business on paper.
  return <div ref={ref} data-chrome className="cursor-glow" aria-hidden />;
}
