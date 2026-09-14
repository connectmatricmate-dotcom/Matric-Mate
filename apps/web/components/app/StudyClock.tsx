'use client';

import { useEffect } from 'react';
import { StudyClock as Clock } from '@matricmate/core';
import { createClient } from '@/lib/supabase/client';
import { useApp } from '@/lib/store';

/** Ten minutes with no touch, click, key or scroll is somebody who has walked away. */
const IDLE_MS = 10 * 60_000;
/** Marking the day as opened, at most this often: a tab flicked back and forth is one visit. */
const OPEN_EVERY_MS = 15 * 60_000;

/**
 * Counts the minutes a student spends in MatricMate, for their daily report
 * and their teacher's view of it (migration 0042).
 *
 * A minute counts when the page is in view and was used in the last ten
 * minutes, or when an audio lesson is playing, which is study with nothing to
 * click. A page left open overnight counts nothing. Mounted once in the app
 * shell, like PushLive; the Android app runs the same rule on its own events.
 */
export function StudyClock() {
  const { state } = useApp();
  const userId = state.user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    const clock = new Clock(createClient());
    let lastInput = Date.now();
    let lastOpen = 0;
    const touched = () => {
      lastInput = Date.now();
    };
    const visible = () => document.visibilityState === 'visible';
    const listening = () => Array.from(document.querySelectorAll('audio')).some((a) => !a.paused);
    const open = () => {
      if (Date.now() - lastOpen < OPEN_EVERY_MS) return;
      lastOpen = Date.now();
      clock.opened();
    };

    const inputs = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;
    for (const e of inputs) window.addEventListener(e, touched, { passive: true, capture: true });
    const onVisibility = () => {
      if (!visible()) return;
      touched();
      open();
    };
    document.addEventListener('visibilitychange', onVisibility);
    if (visible()) open();

    const timer = window.setInterval(() => {
      if ((visible() && Date.now() - lastInput < IDLE_MS) || listening()) clock.minute();
    }, 60_000);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      for (const e of inputs) window.removeEventListener(e, touched, { capture: true });
    };
  }, [userId]);

  return null;
}
