import { NextRequest, NextResponse } from 'next/server';
import { chapterById, reminderHour, weakTopics } from '@matricmate/core';
import type { Attempt, Language } from '@matricmate/core';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  awayFor,
  comeBack,
  notify,
  planUnfinished,
  resumeChapter,
  streakAtRiskTiered,
  streakMilestone,
  weakTopicNudge,
} from '@/lib/notify';
import type { Notice } from '@/lib/notify';

/**
 * The evening nudge, and the thing that makes two settings real.
 *
 * "Study reminder" and "Streak alerts" sat on the settings screen of both apps
 * from the beginning with nothing reading either one. They are read here, from
 * profiles.settings, which is why those preferences moved onto the account.
 *
 * Runs on the hour from 16:00 to 21:00 in Karachi, and each run only writes to
 * the students who chose that hour. The time on the settings screen used to be
 * a label with nothing behind it: everybody was nudged at 19:00 whatever it
 * said. Those are the hours because those are the options, and the two lists
 * come from the same constant (REMINDER_TIMES in core).
 *
 * Evening only, by design. "You have not studied today" is premature at noon,
 * and after nine there is no evening left to act on it.
 *
 * It picks ONE message per student per night, and picks it on purpose. A
 * reminder that says the same sentence every evening for a month is one the
 * student stops seeing by the second week, and then turns off. So the job asks
 * what is actually true about this person tonight, in order of how much it
 * deserves interrupting them, and only falls back to a general nudge when
 * nothing specific applies. Even that fallback rotates through four wordings.
 *
 * Costs nothing per student: no model call, a handful of rows, one insert.
 */

/** Only ever one nudge per student per evening, whichever kind it wins. */
const KINDS = ['reminder', 'streak'];
/**
 * How long since their last activity a student can be and still be nudged.
 *
 * Wider than it used to be, because the win-back ladder has to reach students
 * who have stopped, and by definition they have no recent activity. It stops
 * at three weeks: past that the ladder is done and a nightly tap on the
 * shoulder is noise to somebody who has already left.
 */
const WINDOW_DAYS = 21;
/**
 * How much history to read, which is a different question.
 *
 * Streaks are the reason. Reading only the candidate window meant a 60 day
 * streak was counted as however many days the window was, so the student was
 * warned about losing 21 days when they had 60, and got the middle tier of
 * warning instead of the loudest. The number in that sentence has to be the
 * real one, so the read covers a year and the candidate filter stays at three
 * weeks.
 */
const HISTORY_DAYS = 400;
const MAX_PER_RUN = 500;
/** Streaks worth congratulating rather than passing over in silence. */
const MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];

type ProfileRow = { id: string; settings: unknown; onboarding: { medium?: string } | null; created_at: string };

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

/** Whole days since they last did anything at all. */
function daysSinceLast(days: Set<string>, today: Date): number {
  for (let i = 0; i <= WINDOW_DAYS; i++) {
    const d = new Date(today.getTime() - i * 864e5);
    if (days.has(karachiDay(d))) return i;
  }
  return WINDOW_DAYS + 1;
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
  /** Rotates the general nudge, so it is a different sentence each night. */
  const dayIndex = Math.floor(now.getTime() / 864e5);
  const hourNow = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', hour12: false }).format(now));

  /*
   * Whose hour is it, asked before anything else.
   *
   * This used to read every active_days row for the past year and filter
   * afterwards. That was affordable once a night and is not six times, and it
   * is the wrong way round anyway: the cheap, small table decides who is even
   * eligible this hour, and only then do we look up their history. Paginated
   * because select() silently stops at a thousand rows.
   */
  const profiles: ProfileRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from('profiles').select('id,settings,onboarding,created_at').range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    profiles.push(...((data ?? []) as ProfileRow[]));
    if ((data ?? []).length < 1000) break;
  }

  const dueNow = profiles.filter((p) => {
    const settings = (p.settings ?? {}) as Record<string, unknown>;
    // Absent means never touched, and both default to on. Only an explicit
    // false is a student saying no.
    if (settings.reminders === false && settings.streakAlerts === false) return false;
    return reminderHour(settings.reminderTime as string | undefined) === hourNow;
  });
  if (!dueNow.length) return NextResponse.json({ hour: hourNow, considered: 0, sent: 0 });

  const dueIds = dueNow.map((p) => p.id).slice(0, MAX_PER_RUN);

  const historyStart = karachiDay(new Date(now.getTime() - HISTORY_DAYS * 864e5));
  const { data: dayRows, error } = await admin
    .from('active_days')
    .select('user_id,day')
    .in('user_id', dueIds)
    .gte('day', historyStart)
    .limit(100000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const daysByUser = new Map<string, Set<string>>();
  for (const r of (dayRows ?? []) as { user_id: string; day: string }[]) {
    const set = daysByUser.get(r.user_id) ?? new Set<string>();
    set.add(r.day);
    daysByUser.set(r.user_id, set);
  }

  /*
   * Of those due this hour, the ones still recently active. Someone whose last
   * day was in March is not owed a reminder; the year of history is read only
   * so that a long streak is counted at its real length.
   */
  const everyone = [...daysByUser.entries()].filter(([, days]) => daysSinceLast(days, now) <= WINDOW_DAYS);

  /*
   * And the students who have never studied at all.
   *
   * They were invisible here, because this list was built from active_days and
   * a student with no activity has no rows in it. So the one person most in
   * need of "come and study" was the only one who could never receive it: you
   * could install the app, leave it two days, and nothing would ever arrive.
   *
   * They join on the same terms as everybody else, with an empty day set, and
   * are dropped once their account is older than the window. Past that, a
   * nightly tap on the shoulder is noise to somebody who never started.
   */
  const started = new Set(everyone.map(([id]) => id));
  const neverStarted = new Set<string>();
  for (const p of dueNow) {
    if (started.has(p.id)) continue;
    const age = Math.floor((now.getTime() - Date.parse(p.created_at)) / 864e5);
    if (Number.isFinite(age) && age <= WINDOW_DAYS) {
      neverStarted.add(p.id);
      everyone.push([p.id, new Set<string>()]);
    }
  }

  if (!everyone.length) return NextResponse.json({ hour: hourNow, considered: 0, sent: 0 });
  const ids = everyone.map(([id]) => id);

  const [{ data: sentRecently }, { data: attemptRows }, { data: planRows }] = await Promise.all([
    // Already nudged this evening, so a retried or double-fired cron cannot
    // put a second sentence in the same inbox.
    admin
      .from('notifications')
      .select('user_id')
      .in('user_id', ids)
      .in('kind', KINDS)
      .gte('at', new Date(now.getTime() - 18 * 60 * 60 * 1000).toISOString()),
    admin
      .from('attempts')
      .select('user_id,chapter_id,subject_id,topic,correct,confidence,at')
      .in('user_id', ids)
      .gte('at', new Date(now.getTime() - 30 * 864e5).toISOString())
      .limit(20000),
    admin.from('plan_done').select('user_id').in('user_id', ids).eq('day', today),
  ]);

  const already = new Set(((sentRecently ?? []) as { user_id: string }[]).map((r) => r.user_id));
  const byId = new Map(dueNow.map((p) => [p.id, p]));

  type Row = { user_id: string; chapter_id: string; subject_id: string; topic: string; correct: boolean; confidence: number; at: string };
  const attemptsByUser = new Map<string, Row[]>();
  for (const r of (attemptRows ?? []) as Row[]) {
    const list = attemptsByUser.get(r.user_id) ?? [];
    list.push(r);
    attemptsByUser.set(r.user_id, list);
  }
  const planDoneByUser = new Map<string, number>();
  for (const r of (planRows ?? []) as { user_id: string }[]) {
    planDoneByUser.set(r.user_id, (planDoneByUser.get(r.user_id) ?? 0) + 1);
  }

  let sent = 0;
  const picked: Record<string, number> = {};

  for (const [userId, days] of everyone) {
    if (already.has(userId)) continue;

    const profile = byId.get(userId);
    const settings = ((profile?.settings ?? {}) as Record<string, unknown>) ?? {};
    /*
     * The student's language, taken from the profile rows already loaded above
     * rather than by asking again per student. The dispatcher translates every
     * sentence itself; this is only for the values interpolated INTO one, which
     * it cannot translate because they are content, not copy.
     */
    const lang: Language = profile?.onboarding?.medium === 'ur' ? 'ur' : 'en';
    // Absent means never touched, and both default to on. Only an explicit
    // false is a student saying no.
    const wantsReminder = settings.reminders !== false;
    const wantsStreak = settings.streakAlerts !== false;
    if (!wantsReminder && !wantsStreak) continue;

    const studiedToday = days.has(today);
    const notice = pick({
      studiedToday,
      streakToday: streakEndingAt(days, now),
      streakYesterday: streakEndingAt(days, yesterday),
      awayDays: daysSinceLast(days, now),
      attempts: attemptsByUser.get(userId) ?? [],
      planTicks: planDoneByUser.get(userId) ?? 0,
      wantsReminder,
      wantsStreak,
      dayIndex,
      lang,
      neverStarted: neverStarted.has(userId),
    });
    if (!notice) continue;

    // Through the dispatcher, so the same message reaches the phone and the
    // inbox without this job knowing anything about either.
    const report = await notify(userId, notice);
    if (report.inbox === 'sent') {
      sent++;
      const label = String(notice.title).replace('notifications.', '');
      picked[label] = (picked[label] ?? 0) + 1;
    }
  }

  // The breakdown is the point of the logging: if every student is getting the
  // same generic nudge, the picker is not doing its job and that shows here.
  return NextResponse.json({ hour: hourNow, considered: everyone.length, sent, picked });
}

type Signals = {
  studiedToday: boolean;
  streakToday: number;
  streakYesterday: number;
  awayDays: number;
  attempts: { chapter_id: string; subject_id: string; topic: string; correct: boolean; confidence: number; at: string }[];
  planTicks: number;
  wantsReminder: boolean;
  wantsStreak: boolean;
  dayIndex: number;
  lang: Language;
  /** Signed up, never studied. Every history signal below is empty for them. */
  neverStarted: boolean;
};

/**
 * The one message this student gets tonight, in order of how much it earns the
 * interruption.
 *
 * Ordering is the whole design. A streak about to break is time limited and
 * cannot wait until tomorrow, so it outranks everything. Below that, anything
 * naming a specific thing they left unfinished beats a general "come and
 * study", because it answers "and do what?" before they have to ask it.
 */
function pick(s: Signals): Notice | null {
  // Studied today: nothing to nudge, but a milestone is worth marking. This is
  // the only message here that is good news, and it is why the job does not
  // simply skip everyone who has already been active.
  if (s.studiedToday) {
    return s.wantsStreak && MILESTONES.includes(s.streakToday) ? streakMilestone(s.streakToday) : null;
  }

  // 1. A live streak, tonight, with hours left to save it.
  if (s.wantsStreak && s.streakYesterday >= 2) return streakAtRiskTiered(s.streakYesterday);

  if (!s.wantsReminder) return null;

  /*
   * Never studied. Straight to the rotating general nudge, before the ladder
   * below: "away for 21 days" is measured from a last visit they never made,
   * so the win-back rungs would either say something false or, once past the
   * top rung, say nothing at all.
   */
  if (s.neverStarted) return comeBack(s.dayIndex);

  // 2. Gone for days. The win-back ladder, which runs out after a fortnight.
  if (s.awayDays >= 3) return awayFor(s.awayDays);

  // 3. Today's plan, started and abandoned. Only when they actually began it:
  //    "3 tasks left" to someone who never opened the app reads as a scold.
  if (s.planTicks > 0) return planUnfinished(Math.max(1, 5 - s.planTicks));

  // 4. A chapter left halfway. The most concrete thing we can offer.
  const last = s.attempts.length ? s.attempts[s.attempts.length - 1] : null;
  if (last) {
    const chapter = chapterById(last.chapter_id);
    // The chapter's own Urdu name, not the English one dropped into an Urdu
    // sentence. Topics below stay Latin on purpose: FBISE Urdu-medium
    // textbooks keep technical terms in English, and so does the rest of this
    // app (see the `.latin` rule in globals.css).
    if (chapter) return resumeChapter((s.lang === 'ur' && chapter.urduTitle) || chapter.title);
  }

  // 5. Their genuinely worst topic, named, with the number.
  if (s.attempts.length >= 10) {
    const worst = weakTopics(
      s.attempts.map((a, i) => ({
        id: `n-${i}`,
        mcqId: `${a.chapter_id}-${i}`,
        chapterId: a.chapter_id,
        subjectId: a.subject_id,
        topic: a.topic,
        correct: a.correct,
        confidence: a.confidence as Attempt['confidence'],
        mode: 'practice' as const,
        at: Date.parse(a.at),
      })),
      3,
    )[0];
    if (worst) return weakTopicNudge(worst.topic, worst.accuracy);
  }

  // 6. Nothing specific to say, so say something general, and a different
  //    something from last night.
  return comeBack(s.dayIndex);
}
