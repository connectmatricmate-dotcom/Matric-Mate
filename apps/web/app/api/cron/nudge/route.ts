import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { nothingStudiedToday, notify, streakAtRisk } from '@/lib/notify';

/**
 * The evening nudge, and the thing that finally makes two settings real.
 *
 * "Study reminder" and "Streak alerts" have been on the settings screen of
 * both apps since the beginning. The website let you flip them and stored the
 * result in that browser; the phone refused to latch them at all and toasted
 * "coming soon". Nothing anywhere read either one, so the same student saw
 * them on in one app and off in the other, and neither state meant anything.
 *
 * They are read here. The preferences live on the account now (profiles.
 * settings, see syncNotifyPrefs) precisely so this job can see them.
 *
 * Runs at 14:00 UTC, which is 19:00 in Karachi: late enough that "you have not
 * studied today" is true rather than premature, early enough that there is
 * still an evening left to do something about it. That is also why the default
 * reminder time reads 7:00 PM.
 *
 * Costs nothing per student: no model call, one insert. The expensive job is
 * the coach report next door.
 */

/** Only ever one nudge per student per evening, whichever kind it is. */
const KINDS = ['reminder', 'streak'];
/** Dormant accounts are left alone. Someone who last opened the app in June
 *  does not need a nightly tap on the shoulder to remind them of that. */
const ACTIVE_WINDOW_DAYS = 14;
/** A ceiling per run, matching the coach job's. */
const MAX_PER_RUN = 500;

const karachiDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(d);

/** Consecutive days up to and including `upto`, counted the way the apps count them. */
function streakEndingAt(days: Set<string>, upto: Date): number {
  let n = 0;
  const d = new Date(upto);
  for (;;) {
    if (!days.has(karachiDay(d))) break;
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const today = karachiDay(now);
  const yesterday = new Date(now.getTime() - 864e5);

  // Everyone who has studied at all recently. active_days is one row per
  // student per day, so this is a small read even across the whole base.
  const windowStart = karachiDay(new Date(now.getTime() - ACTIVE_WINDOW_DAYS * 864e5));
  const { data: dayRows, error } = await admin
    .from('active_days')
    .select('user_id,day')
    .gte('day', windowStart)
    .limit(20000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const daysByUser = new Map<string, Set<string>>();
  for (const r of (dayRows ?? []) as { user_id: string; day: string }[]) {
    const set = daysByUser.get(r.user_id) ?? new Set<string>();
    set.add(r.day);
    daysByUser.set(r.user_id, set);
  }

  // Anyone who has already studied today needs no nudge at all.
  const candidates = [...daysByUser.entries()].filter(([, days]) => !days.has(today)).slice(0, MAX_PER_RUN);
  if (!candidates.length) return NextResponse.json({ considered: 0, written: 0 });

  const ids = candidates.map(([id]) => id);

  const [{ data: profiles }, { data: sentToday }] = await Promise.all([
    admin.from('profiles').select('id,settings,onboarding').in('id', ids),
    // Sent already this evening, so a retried or double-fired cron does not
    // put the same sentence in the inbox twice.
    admin
      .from('notifications')
      .select('user_id,kind')
      .in('user_id', ids)
      .in('kind', KINDS)
      .gte('at', new Date(now.getTime() - 18 * 60 * 60 * 1000).toISOString()),
  ]);

  const already = new Set(((sentToday ?? []) as { user_id: string }[]).map((r) => r.user_id));
  const byId = new Map(
    ((profiles ?? []) as { id: string; settings: unknown; onboarding: unknown }[]).map((p) => [p.id, p]),
  );

  let written = 0;

  for (const [userId, days] of candidates) {
    if (already.has(userId)) continue;

    const profile = byId.get(userId);
    const settings = (profile?.settings ?? {}) as Record<string, unknown>;
    // Absent means never touched, and both default to on. Only an explicit
    // false is a student saying no.
    const wantsReminder = settings.reminders !== false;
    const wantsStreak = settings.streakAlerts !== false;
    if (!wantsReminder && !wantsStreak) continue;

    // A streak that is still alive as of yesterday is the more urgent of the
    // two, and it says something the plain reminder does not, so it wins.
    const streak = streakEndingAt(days, yesterday);
    const notice = wantsStreak && streak >= 2 ? streakAtRisk(streak) : wantsReminder ? nothingStudiedToday() : null;
    if (!notice) continue;

    // Through the dispatcher, so a nudge reaches the phone as well as the
    // inbox once push is switched on, without this job knowing about either.
    // Sequential rather than a batch insert: it is one row per student either
    // way, and a fan-out per student is not something to run 500 of at once.
    const report = await notify(userId, notice);
    if (report.inbox === 'sent') written++;
  }

  return NextResponse.json({ considered: candidates.length, written });
}
