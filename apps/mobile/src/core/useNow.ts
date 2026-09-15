import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { todayKey } from '@matricmate/core';

const PKT_MS = 5 * 3600_000;
const DAY_MS = 864e5;
/** The Karachi day a moment falls on, as todayKey counts days (UTC+5, no DST). */
const dayOf = (ms: number) => new Date(ms + PKT_MS).toISOString().slice(0, 10);

/**
 * "Now" for a screen: read once and held still while it is looked at, so a
 * seven-day window does not slide under the numbers, but moved on when the
 * day turns. The screens used to read it once on mount, and the tab screens
 * are never unmounted: a phone left open overnight showed yesterday as
 * "today" until the app was killed. Moved at Karachi midnight, and on the
 * way back to the front when the day has changed meanwhile.
 */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const day = dayOf(now);
    const timer = setTimeout(() => setNow(Date.now()), DAY_MS - ((now + PKT_MS) % DAY_MS) + 1000);
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active' && todayKey() !== day) setNow(Date.now());
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [now]);
  return now;
}
