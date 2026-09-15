'use client';

/**
 * The subjects, scrolling past.
 *
 * The movement is a CSS animation. The list is rendered twice because a
 * marquee only loops seamlessly if the second copy is already in place when
 * the first scrolls out. The duplicate is hidden from screen readers, which
 * should hear the subjects once.
 *
 * It stops when asked and when nobody can see it. Anything that moves on its
 * own for more than a few seconds needs a way to stop it (the button at its
 * end, for touch and keyboard; hovering still pauses it with a mouse), and it
 * ran on for as long as the page was open, scrolled far out of view.
 * prefers-reduced-motion stops it altogether, in globals.css, and hides the
 * button with it.
 */
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui';
import type { IconName } from '@matricmate/core';

const SUBJECTS: { icon: IconName; label: string }[] = [
  { icon: 'phy', label: 'Physics' },
  { icon: 'chem', label: 'Chemistry' },
  { icon: 'bio', label: 'Biology' },
  { icon: 'math', label: 'Mathematics' },
  { icon: 'eng', label: 'English' },
  { icon: 'urd', label: 'Urdu' },
  { icon: 'isl', label: 'Islamiyat' },
  { icon: 'pst', label: 'Pakistan Studies' },
  { icon: 'cs', label: 'Computer Science' },
];

function Row({ hidden, paused }: { hidden?: boolean; paused: boolean }) {
  return (
    <div aria-hidden={hidden} style={paused ? { animationPlayState: 'paused' } : undefined}>
      {SUBJECTS.map((s) => (
        // White, not tealtint: the hero is night in both themes, and tealtint
        // turns dark navy in the dark one, which left the chips blank.
        <span
          key={s.label}
          className="flex items-center gap-2 whitespace-nowrap rounded-full border border-white/12 bg-white/6 px-4 py-2 text-[13.5px] font-extrabold text-white/85"
        >
          <Icon name={s.icon} size={15} className="text-cyan" />
          {s.label}
        </span>
      ))}
    </div>
  );
}

export function SubjectMarquee() {
  const strip = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    const el = strip.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const paused = stopped || !inView;
  return (
    <div className="flex items-center">
      <div ref={strip} className="marquee min-w-0 flex-1">
        <Row paused={paused} />
        <Row hidden paused={paused} />
      </div>
      <button
        type="button"
        onClick={() => setStopped((s) => !s)}
        aria-pressed={stopped}
        aria-label={stopped ? 'Start the moving list of subjects' : 'Stop the moving list of subjects'}
        className="me-3 ms-1 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-white/6 text-white/85 transition-colors duration-200 hover:bg-white/15 motion-reduce:hidden"
      >
        <Icon name={stopped ? 'play' : 'pause'} size={16} />
      </button>
    </div>
  );
}
