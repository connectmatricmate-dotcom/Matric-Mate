'use client';

/**
 * "Now", read once on the client and then held still, until the day turns.
 *
 * Calling `Date.now()` during render is impure: React may re-render at any
 * moment, so a `useMemo` keyed on a fresh timestamp would recompute for no
 * reason, and two reads in the same paint could disagree. A "last 7 days"
 * window should not slide while someone reads it.
 *
 * It does move at midnight in Karachi, and when the tab comes back into view
 * on a new day. Held for the life of the tab, a page left open overnight kept
 * yesterday as "today": yesterday's plan, yesterday's report, and a streak
 * that looked broken until a reload.
 *
 * The server snapshot is 0 deliberately: the store is empty until hydration, so
 * no rendered value depends on it, and the client's own clock is the one that
 * matters for a date range the user is looking at.
 */
import { useSyncExternalStore } from 'react';
import { todayKey } from '@matricmate/core';

let firstRead = 0;
let day = '';
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

/** Checks the day, and when it has turned, moves "now" and tells every screen. */
function tick(): void {
  const next = todayKey();
  if (day && next !== day) {
    firstRead = Date.now();
    day = next;
    listeners.forEach((l) => l());
  }
  day = next;
  arm();
}

/** A timer for a second past the next Karachi midnight (UTC+5 all year). */
function arm(): void {
  if (timer) clearTimeout(timer);
  const midnight = Date.parse(`${todayKey()}T00:00:00+05:00`) + 864e5;
  timer = setTimeout(tick, Math.max(1000, midnight - Date.now() + 1000));
}

const onVisible = () => {
  if (document.visibilityState === 'visible') tick();
};

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    day = todayKey();
    arm();
    document.addEventListener('visibilitychange', onVisible);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    if (timer) clearTimeout(timer);
    timer = undefined;
    document.removeEventListener('visibilitychange', onVisible);
  };
}

const clientNow = () => (firstRead ||= Date.now());
const serverNow = () => 0;

export const useNow = () => useSyncExternalStore(subscribe, clientNow, serverNow);

/** Today's Karachi day key, moving at midnight like useNow. For memos built on todayKey(). */
const clientDay = () => day || todayKey();
export const useToday = () => useSyncExternalStore(subscribe, clientDay, todayKey);
