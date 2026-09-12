'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { fetchTutorQuota, getQuota, quotaTopic, setQuota, subscribeQuota } from '@matricmate/core';
import { createClient } from '@/lib/supabase/client';

/**
 * One read of the server's count at a time, however many screens ask for it.
 * Every mounted reader asks whenever the count is missing, which is several
 * at once on the tutor page.
 */
let inflight: Promise<unknown> | null = null;

function fetchOnce(): void {
  if (inflight || getQuota()) return;
  inflight = fetchTutorQuota().finally(() => {
    inflight = null;
  });
}

/**
 * How many AI questions are left today, the same answer on every screen.
 *
 * This used to fetch its own copy per component, and three components used it,
 * so three screens could hold three different numbers. Worse, the header and
 * the reader did not use it at all: they read a local counter the client kept,
 * one per action, while the server charges per feature (a mock paper is three).
 * One paper and the header was two ahead of the tutor page, which is the
 * inconsistency the client reported.
 *
 * Now there is a single store in @matricmate/core that every AI response writes
 * to, and this subscribes to it. Mount it anywhere, as often as you like: one
 * fetch serves every reader, and every reader sees the same value in the same
 * tick.
 *
 * Fetched again whenever the store has no count: a different student signing
 * in clears it, and so does midnight (core drops a count whose reset time has
 * passed). Asking only on the first mount left the second student in a tab
 * with the first one's number, and a student who hit the limit locked out
 * after the day had turned over.
 */
export function useTutorQuota() {
  const quota = useSyncExternalStore(subscribeQuota, getQuota, () => null);

  useEffect(() => {
    if (!quota) fetchOnce();
  }, [quota]);

  return [quota, setQuota] as const;
}

/**
 * Keeps the shared quota current without polling.
 *
 * Mounted once, in the app shell. A write to ai_usage broadcasts on the
 * student's own topic, so a question asked on their phone moves the number on
 * their laptop, and a background charge they did not initiate still shows up.
 * Also asks again when the tab comes back into view, which is when a count
 * left open overnight is most likely to be yesterday's.
 *
 * Broadcast rather than postgres_changes, per the house rule in
 * docs/engineering/Supabase Realtime Guide.md. The trigger is migration 0015.
 */
export function useQuotaRealtime(userId: string | null | undefined) {
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(quotaTopic(userId), { config: { private: false } })
      .on('broadcast', { event: 'change' }, (message) => {
        const payload = message.payload as { used?: number };
        if (typeof payload.used !== 'number') return;
        // The payload carries the count, not the allowance or the day. With
        // today's count in hand it updates that; without one (none yet, or
        // yesterday's has expired) the server is asked rather than today's
        // being pieced together from an old reset time.
        const now = getQuota();
        if (!now) {
          fetchOnce();
          return;
        }
        setQuota({ ...now, used: payload.used, remaining: Math.max(0, now.limit - payload.used) }, userId);
      })
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchOnce();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void supabase.removeChannel(channel);
    };
  }, [userId]);
}

/** "21:00" style local clock time out of the server's reset instant. */
export const quotaClock = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
