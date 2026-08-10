'use client';

/**
 * Leans its child toward the pointer in 3D.
 *
 * The rotation is derived from where the pointer sits inside the element, so
 * the card appears to face whoever is looking at it. Writes two custom
 * properties and lets the CSS transform in globals.css apply them; reads
 * geometry once per enter rather than per move, so a fast mouse does not
 * force a layout on every frame.
 *
 * Inert on touch, where there is no hover to respond to.
 */
import { useRef } from 'react';

export function Tilt({
  children,
  className = '',
  /** Degrees of lean at the very edge. Small numbers read as premium. */
  max = 7,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const box = useRef<DOMRect | null>(null);

  const enter = () => {
    const el = ref.current;
    if (!el) return;
    box.current = el.getBoundingClientRect();
    el.classList.add('tracking');
  };

  const move = (e: React.PointerEvent) => {
    const el = ref.current;
    const b = box.current;
    if (!el || !b) return;
    const px = (e.clientX - b.left) / b.width - 0.5;
    const py = (e.clientY - b.top) / b.height - 0.5;
    // Y rotation follows horizontal travel, X rotation is inverted so the
    // top edge tips away as the pointer moves down. That is which way a real
    // object would lean.
    el.style.setProperty('--ry', `${(px * max * 2).toFixed(2)}deg`);
    el.style.setProperty('--rx', `${(-py * max * 2).toFixed(2)}deg`);
  };

  const leave = () => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove('tracking');
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  };

  return (
    <div
      ref={ref}
      className={`tilt ${className}`}
      onPointerEnter={enter}
      onPointerMove={move}
      onPointerLeave={leave}
    >
      {children}
    </div>
  );
}
