import { useEffect, useSyncExternalStore } from 'react';
import { fetchTutorQuota, getQuota, quotaTopic, setQuota, subscribeQuota } from '@matricmate/core';
import type { TutorQuota } from '@matricmate/core';
import { supabase } from '../lib/supabase';

/**
 * How many AI questions are left today, the same answer on every screen.
 *
 * The tutor tab and the chat screen each fetched their own copy, and the
 * reader did not fetch at all: it read a local counter the app keeps, one per
 * action. The server charges per feature though (a mock paper is three, a
 * generated set is two), so one paper left the reader two ahead of the tutor
 * tab. That, plus the counter being per device, is the inconsistency the
 * client reported.
 *
 * All of them now read one store in @matricmate/core that every AI response
 * writes to. Mount this wherever the number is shown; the fetch happens once.
 */
export function useQuota(): TutorQuota | null {
  const quota = useSyncExternalStore(subscribeQuota, getQuota, () => null);
  useEffect(() => {
    if (!getQuota()) void fetchTutorQuota();
  }, []);
  return quota;
}

/**
 * Keeps the shared quota current without polling.
 *
 * Mounted once, at the app root. A question asked on this student's laptop
 * moves the number on their phone, and a charge the app did not initiate still
 * shows up. Broadcast rather than postgres_changes, per the house rule in
 * docs/engineering/Supabase Realtime Guide.md; the trigger is migration 0015.
 */
export function useQuotaRealtime(userId: string | null | undefined): void {
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(quotaTopic(userId), { config: { private: false } })
      .on('broadcast', { event: 'change' }, (message) => {
        const payload = message.payload as { used?: number };
        if (typeof payload.used !== 'number') return;
        const now = getQuota();
        // The payload carries the count, not the allowance. With no quota in
        // hand there is no limit to subtract from, so ask rather than guess.
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
