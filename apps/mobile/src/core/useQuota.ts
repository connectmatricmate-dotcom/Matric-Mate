import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { fetchTutorQuota, getQuota, quotaTopic, setQuota, subscribeQuota } from '@matricmate/core';
import type { TutorQuota } from '@matricmate/core';
import { supabase } from '../lib/supabase';

/** How often the root hook looks for a day that has ended. A comparison, not a request. */
const ROLLOVER_CHECK_MS = 60_000;

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
 * writes to. Mount this wherever the number is shown; the fetch happens when
 * the store has nothing for today, which includes a count whose day has ended
 * (getQuota answers null for that).
 */
export function useQuota(): TutorQuota | null {
  const quota = useSyncExternalStore(subscribeQuota, getQuota, () => null);
  useEffect(() => {
    if (!getQuota()) void fetchTutorQuota();
  }, []);
  return quota;
}

/**
 * Keeps the shared quota current without polling the server.
 *
 * Mounted once, at the app root. A question asked on this student's laptop
 * moves the number on their phone, and a charge the app did not initiate still
 * shows up. Broadcast rather than postgres_changes, per the house rule in
 * docs/engineering/Supabase Realtime Guide.md; the trigger is migration 0015.
 *
 * Whose count the store holds is set by the auth store (setQuotaUser), which
 * empties it between students; see adopt in store/auth.tsx.
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
        // The payload carries the count, not the allowance or the day. With no
        // quota in hand for today there is no limit to subtract from, and
        // copying an old one forward would pin yesterday's reset time onto
        // today's count. Ask rather than guess.
        if (!now) {
          void fetchTutorQuota();
          return;
        }
        setQuota({ ...now, used: payload.used, remaining: Math.max(0, now.limit - payload.used) }, userId);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  /**
   * Midnight, and a phone that was asleep.
   *
   * Realtime does not deliver what happened while the app was in the
   * background, and nothing tells the store a new day has started: a student
   * who hit the limit stayed locked after midnight until the app process
   * died. So once a count has been shown to this student, it is read again on
   * the way back to the foreground, and again as soon as its day has ended.
   */
  useEffect(() => {
    if (!userId) return;
    let shown = Boolean(getQuota());
    const unsubscribe = subscribeQuota(() => {
      if (getQuota()) shown = true;
    });
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active' && shown) void fetchTutorQuota();
    });
    const tick = setInterval(() => {
      if (shown && !getQuota() && AppState.currentState === 'active') void fetchTutorQuota();
    }, ROLLOVER_CHECK_MS);
    return () => {
      unsubscribe();
      sub.remove();
      clearInterval(tick);
    };
  }, [userId]);
}
