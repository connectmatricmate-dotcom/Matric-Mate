'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { fetchTutorQuota, getQuota, quotaTopic, setQuota, subscribeQuota } from '@matricmate/core';
import { createClient } from '@/lib/supabase/client';

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
 * to, and this subscribes to it. Mount it anywhere, as often as you like: the
 * fetch happens once, and every reader sees the same value in the same tick.
 */
export function useTutorQuota() {
  const quota = useSyncExternalStore(subscribeQuota, getQuota, () => null);

  useEffect(() => {
    // Only the first mount pays for this; afterwards the store already holds a
    // value and every other screen reads it for free.
    if (!getQuota()) void fetchTutorQuota();
  }, []);

  return [quota, setQuota] as const;
}

/**
 * Keeps the shared quota current without polling.
 *
 * Mounted once, in the app shell. A write to ai_usage broadcasts on the
 * student's own topic, so a question asked on their phone moves the number on
 * their laptop, and a background charge they did not initiate still shows up.
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
        const now = getQuota();
        // The payload carries the count, not the allowance. Without a quota
        // already in hand there is no limit to subtract from, so ask the
        // server rather than invent one.
        if (typeof payload.used !== 'number') return;
        if (!now) {
          void fetchTutorQuota();
          return;
        }
        setQuota({ ...now, used: payload.used, remaining: Math.max(0, now.limit - payload.used) });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);
}

/** "21:00" style local clock time out of the server's reset instant. */
export const quotaClock = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
