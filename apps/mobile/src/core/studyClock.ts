import { useEffect } from 'react';
import { AppState } from 'react-native';
import { StudyClock } from '@matricmate/core';
import { supabase } from '../lib/supabase';

/**
 * Counts the minutes a student spends in MatricMate, for their daily report
 * and their teacher's view of it (migration 0042). The website runs the same
 * rule on its own events (apps/web/components/app/StudyClock.tsx).
 *
 * A minute counts when the app is in front and was touched in the last ten
 * minutes, or when an audio lesson is playing, which is study with nothing to
 * touch. A phone left on the desk with the app open counts nothing. Minutes
 * that could not be sent (no signal) wait in the clock and go with the next.
 */

/** Ten minutes with no touch or scroll is somebody who has put the phone down. */
const IDLE_MS = 10 * 60_000;
/** Marking the day as opened, at most this often: flicking between apps is one visit. */
const OPEN_EVERY_MS = 15 * 60_000;

let lastTouch = Date.now();
let listening = false;

/** Any touch or scroll anywhere in the app: the root view calls this on every one. */
export function markTouched(): void {
  lastTouch = Date.now();
}

/** The audio lesson says when it is playing, so listening counts as study. */
export function setListening(on: boolean): void {
  listening = on;
}

export function useStudyClock(userId: string | null | undefined): void {
  useEffect(() => {
    if (!userId) return;
    const clock = new StudyClock(supabase);
    let lastOpen = 0;
    const open = () => {
      if (Date.now() - lastOpen < OPEN_EVERY_MS) return;
      lastOpen = Date.now();
      clock.opened();
    };
    if (AppState.currentState === 'active') open();
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      markTouched();
      open();
    });
    const timer = setInterval(() => {
      const inFront = AppState.currentState === 'active';
      if ((inFront && Date.now() - lastTouch < IDLE_MS) || listening) clock.minute();
    }, 60_000);
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [userId]);
}
