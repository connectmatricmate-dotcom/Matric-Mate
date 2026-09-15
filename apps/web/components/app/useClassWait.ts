'use client';

import { useEffect, useState } from 'react';
import { useNow } from '@/lib/now';
import { createClient } from '@/lib/supabase/client';

const WEEK_MS = 7 * 864e5;
/** A second change this soon after the first is a correction, and allowed. Migration 0014. */
const CORRECTION_MS = 30 * 60e3;

/**
 * When the class last changed, and until when the next change has to wait.
 *
 * The database holds the rule (enforce_grade_cooldown): a change inside 30
 * minutes of the last is a correction, after that the next one waits until 7
 * days have passed. The two places a class is changed used to learn this only
 * from a refusal, shown as a toast that is gone in two seconds, so the button
 * looked dead. They say it on the page now, before and after a try.
 *
 * `reread` after a change or a refusal, so the note follows the new date.
 */
export function useClassWait(userId: string | undefined) {
  const [changedAt, setChangedAt] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void createClient()
      .from('profiles')
      .select('grade_changed_at')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        const at = data?.grade_changed_at ? Date.parse(String(data.grade_changed_at)) : NaN;
        if (alive) setChangedAt(Number.isFinite(at) ? at : null);
      });
    return () => {
      alive = false;
    };
  }, [userId, round]);
  const now = useNow();
  const waitUntil = changedAt && now && changedAt > now - WEEK_MS && changedAt <= now - CORRECTION_MS ? changedAt + WEEK_MS : null;
  return { changedAt, waitUntil, reread: () => setRound((n) => n + 1) };
}
