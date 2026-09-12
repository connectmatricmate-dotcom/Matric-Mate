import { NextRequest, NextResponse } from 'next/server';
import { reminderHour, weakTopics } from '@matricmate/core';
import type { Attempt, Language } from '@matricmate/core';
import { planIsActive } from '@/lib/entitlement';
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
import type { Notice, Recipient } from '@/lib/notify';
import { JobError, chunks, cronAuthorised, eachLimited, pageAll } from '@/lib/notify/jobs';

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
 * Students with a plan only. Staff accounts were being told to come and study,
 * and a student without a plan was being sent to screens that only bounce them
 * to the price list.
 *
 * Safe to run twice in the same hour, and it is: a second pg_cron entry calls
 * it again five minutes later (migration 0040). Anyone already nudged tonight
 * is skipped, so the second run only reaches the students the first one could
 * not, because the database timed out or the run ran out of time.
 *
 * Costs nothing per student: no model call, a handful of rows, one insert.
 */

export const maxDuration = 300;

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
/** A ceiling on one run. Anyone past it is logged, and the :05 run takes them. */
const MAX_PER_RUN = 500;
/** Students sent to at once. One at a time, a run reached about ninety. */
const CONCURRENCY = 8;
/**
 * When to stop starting new sends. Well inside the two minutes pg_net waits
 * for an answer, so a run that has to stop early still gets to say so.
 */
const BUDGET_MS = 100_000;
/** A weak topic already named within this many days is not named again. */
const TOPIC_REPEAT_DAYS = 3;
/** Tasks on today's plan: buildPlan in core makes three. */
const PLAN_TASKS = 3;
/** Streaks worth congratulating rather than passing over in silence. */
const MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];

type ProfileRow = { id: string; settings: unknown; onboarding: { medium?: string } | null; created_at: string };
type AttemptRow = { user_id: string; chapter_id: string; subject_id: string; topic: string; correct: boolean; confidence: number; at: string };

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

/** One paged read per slice of ids, one slice after another. */
async function forIds<Row>(
  stage: string,
  ids: string[],
  page: (slice: string[], from: number, to: number, signal: AbortSignal) => PromiseLike<{ data: Row[] | null; error: { message: string } | null; status?: number }>,
): Promise<Row[]> {
  const out: Row[] = [];
  for (const slice of chunks(ids)) out.push(...(await pageAll<Row>(stage, (from, to, signal) => page(slice, from, to, signal))));
  return out;
}

export async function GET(req: NextRequest) {
  if (!cronAuthorised(req)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  try {
    return await run();
  } catch (e) {
    // A read that failed even after retrying. Not a 200: pg_cron records the
    // run as succeeded whatever happens, so this status is the only trace.
    console.error('[cron/nudge] run failed', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: 'incomplete', stage: e instanceof JobError ? e.stage : 'unknown', detail: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
}

async function run(): Promise<NextResponse> {
  const startedAt = Date.now();
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
   * The cheap, small table decides who is even eligible this hour, and only
   * then do we look up their history. Students only, in a stable order so the
   * pages neither skip nor repeat anyone.
   */
  const profiles = await pageAll<ProfileRow>('profiles', (from, to, signal) =>
    admin
      .from('profiles')
      .select('id,settings,onboarding,created_at')
      .eq('role', 'student')
      .order('id')
      .range(from, to)
      .abortSignal(signal),
  );

  const dueHour = profiles.filter((p) => {
    const settings = (p.settings ?? {}) as Record<string, unknown>;
    // Absent means never touched, and both default to on. Only an explicit
    // false is a student saying no.
    if (settings.reminders === false && settings.streakAlerts === false) return false;
    return reminderHour(settings.reminderTime as string | undefined) === hourNow;
  });
  if (!dueHour.length) return NextResponse.json({ hour: hourNow, considered: 0, sent: 0 });

  // With a plan, by the same rule as the paywall.
  const plans = await forIds<{ user_id: string; active: boolean | null; valid_till: string | null }>(
    'entitlements',
    dueHour.map((p) => p.id),
    (slice, from, to, signal) =>
      admin.from('entitlements').select('user_id,active,valid_till').in('user_id', slice).order('user_id').range(from, to).abortSignal(signal),
  );
  const paying = new Set(plans.filter(planIsActive).map((e) => e.user_id));
  const due = dueHour.filter((p) => paying.has(p.id));
  if (!due.length) return NextResponse.json({ hour: hourNow, considered: 0, sent: 0 });

  /*
   * What we have told them lately. The last 18 hours decide "already nudged
   * this evening", so a retried or double-fired run cannot put a second
   * sentence in the same inbox. The last few days decide whether tonight's
   * weak topic was already named: the same "X is your weakest topic" went
   * out four nights running to one student.
   */
  const lately = await forIds<{ user_id: string; title: string; body: string; at: string }>(
    'notifications',
    due.map((p) => p.id),
    (slice, from, to, signal) =>
      admin
        .from('notifications')
        .select('user_id,title,body,at')
        .in('user_id', slice)
        .in('kind', KINDS)
        .gte('at', new Date(now.getTime() - TOPIC_REPEAT_DAYS * 864e5).toISOString())
        .order('id')
        .range(from, to)
        .abortSignal(signal),
  );
  const tonight = now.getTime() - 18 * 60 * 60 * 1000;
  const already = new Set(lately.filter((n) => Date.parse(n.at) >= tonight).map((n) => n.user_id));
  const saidLately = new Map<string, string[]>();
  for (const n of lately) saidLately.set(n.user_id, [...(saidLately.get(n.user_id) ?? []), `${n.title} ${n.body}`]);

  /*
   * The ceiling applies after the ones already nudged are set aside, so a
   * second run carries on from where the first stopped rather than meeting
   * the same five hundred again.
   */
  const pending = due.filter((p) => !already.has(p.id));
  const batch = pending.slice(0, MAX_PER_RUN);
  const dropped = pending.length - batch.length;
  if (dropped) console.warn(`[cron/nudge] ${dropped} students over the per-run ceiling, left for the next run`);
  if (!batch.length) return NextResponse.json({ hour: hourNow, considered: 0, sent: 0 });

  const historyStart = karachiDay(new Date(now.getTime() - HISTORY_DAYS * 864e5));
  const dayRows = await forIds<{ user_id: string; day: string }>(
    'active_days',
    batch.map((p) => p.id),
    (slice, from, to, signal) =>
      admin
        .from('active_days')
        .select('user_id,day')
        .in('user_id', slice)
        .gte('day', historyStart)
        .order('user_id')
        .order('day')
        .range(from, to)
        .abortSignal(signal),
  );
  const daysByUser = new Map<string, Set<string>>();
  for (const r of dayRows) {
    const set = daysByUser.get(r.user_id) ?? new Set<string>();
    set.add(r.day);
    daysByUser.set(r.user_id, set);
  }

  /*
   * Of those due this hour, the ones still recently active, and the ones who
   * have never studied at all.
   *
   * The second group used to be invisible, because this list was built from
   * active_days and a student with no activity has no rows in it. So the one
   * person most in need of "come and study" was the only one who could never
   * receive it. They join with an empty day set, and are dropped once their
   * account is older than the window: past that, a nightly tap on the
   * shoulder is noise to somebody who never started.
   */
  const candidates: { profile: ProfileRow; days: Set<string>; neverStarted: boolean }[] = [];
  for (const p of batch) {
    const days = daysByUser.get(p.id);
    if (days && daysSinceLast(days, now) <= WINDOW_DAYS) {
      candidates.push({ profile: p, days, neverStarted: false });
      continue;
    }
    const age = Math.floor((now.getTime() - Date.parse(p.created_at)) / 864e5);
    if (!days?.size && Number.isFinite(age) && age <= WINDOW_DAYS) candidates.push({ profile: p, days: new Set(), neverStarted: true });
  }
  if (!candidates.length) return NextResponse.json({ hour: hourNow, considered: 0, sent: 0 });
  const ids = candidates.map((c) => c.profile.id);

  /*
   * Attempts only for the students whose message could depend on them:
   * someone who studied today or never has gets a message that does not.
   * Oldest first, so the last row per student really is their latest; this
   * read had no order, and "the chapter they left halfway" was whichever row
   * the database happened to return last.
   */
  const needAttempts = candidates.filter((c) => !c.neverStarted && !c.days.has(today)).map((c) => c.profile.id);
  const [attemptRows, planRows] = await Promise.all([
    forIds<AttemptRow>('attempts', needAttempts, (slice, from, to, signal) =>
      admin
        .from('attempts')
        .select('user_id,chapter_id,subject_id,topic,correct,confidence,at')
        .in('user_id', slice)
        .gte('at', new Date(now.getTime() - 30 * 864e5).toISOString())
        .order('at')
        .order('id')
        .range(from, to)
        .abortSignal(signal),
    ),
    forIds<{ user_id: string; task_id: string }>('plan_done', ids, (slice, from, to, signal) =>
      admin
        .from('plan_done')
        .select('user_id,task_id')
        .in('user_id', slice)
        .eq('day', today)
        .order('user_id')
        .order('task_id')
        .range(from, to)
        .abortSignal(signal),
    ),
  ]);

  const attemptsByUser = new Map<string, AttemptRow[]>();
  for (const r of attemptRows) attemptsByUser.set(r.user_id, [...(attemptsByUser.get(r.user_id) ?? []), r]);
  const planDoneByUser = new Map<string, number>();
  for (const r of planRows) planDoneByUser.set(r.user_id, (planDoneByUser.get(r.user_id) ?? 0) + 1);

  /*
   * Chapter names from the chapters table. The bundled catalogue on this
   * server knows only FBISE Class 9, so for every Class 10 and Punjab student
   * the "resume chapter" message could never be written, and they got the
   * weak-topic one instead, night after night.
   */
  const lastChapterIds = [...new Set([...attemptsByUser.values()].map((rows) => rows[rows.length - 1]?.chapter_id).filter(Boolean))];
  const chapterRows = await forIds<{ id: string; title: string; urdu_title: string | null }>('chapters', lastChapterIds, (slice, from, to, signal) =>
    admin.from('chapters').select('id,title,urdu_title').in('id', slice).order('id').range(from, to).abortSignal(signal),
  );
  const chapterById = new Map(chapterRows.map((c) => [c.id, c]));

  const stopAt = startedAt + BUDGET_MS;
  let sent = 0;
  let failed = 0;
  const picked: Record<string, number> = {};

  const reached = await eachLimited(
    candidates,
    CONCURRENCY,
    async ({ profile, days, neverStarted }) => {
      const settings = (profile.settings ?? {}) as Record<string, unknown>;
      /*
       * The student's language, taken from the profile rows already loaded
       * above rather than by asking again per student. The dispatcher
       * translates every sentence itself; this is only for the values
       * interpolated INTO one, which it cannot translate because they are
       * content, not copy.
       */
      const lang: Language = profile.onboarding?.medium === 'ur' ? 'ur' : 'en';
      // Absent means never touched, and both default to on. Only an explicit
      // false is a student saying no.
      const wantsReminder = settings.reminders !== false;
      const wantsStreak = settings.streakAlerts !== false;
      if (!wantsReminder && !wantsStreak) return;

      const attempts = attemptsByUser.get(profile.id) ?? [];
      const last = attempts[attempts.length - 1];
      const chapter = last ? chapterById.get(last.chapter_id) : undefined;
      const notice = pick({
        studiedToday: days.has(today),
        streakToday: streakEndingAt(days, now),
        streakYesterday: streakEndingAt(days, yesterday),
        awayDays: daysSinceLast(days, now),
        attempts,
        // The chapter's own Urdu name, not the English one dropped into an
        // Urdu sentence. Topics stay Latin on purpose: Urdu-medium textbooks
        // keep technical terms in English, and so does the rest of this app.
        lastChapter: chapter ? (lang === 'ur' && chapter.urdu_title) || chapter.title : null,
        planTicks: planDoneByUser.get(profile.id) ?? 0,
        saidLately: saidLately.get(profile.id) ?? [],
        wantsReminder,
        wantsStreak,
        dayIndex,
        neverStarted,
      });
      if (!notice) return;

      /*
       * The recipient from the row already in hand. Loading it per student
       * cost a profile read and an auth lookup each, for an email address a
       * nudge never uses.
       */
      const recipient: Recipient = {
        userId: profile.id,
        lang,
        email: null,
        prefs: { channelPush: settings.channelPush !== false, channelEmail: settings.channelEmail !== false },
      };
      // Through the dispatcher, so the same message reaches the phone and the
      // inbox without this job knowing anything about either.
      const report = await notify(recipient, notice);
      if (report.inbox === 'sent') {
        sent++;
        const label = String(notice.title).replace('notifications.', '');
        picked[label] = (picked[label] ?? 0) + 1;
      } else failed++;
    },
    () => Date.now() > stopAt,
  );

  const unfinished = candidates.length - reached;
  // The breakdown is the point of the logging: if every student is getting the
  // same generic nudge, the picker is not doing its job and that shows here.
  const summary = { hour: hourNow, considered: candidates.length, sent, failed, unfinished, dropped, picked };
  /*
   * Anyone not reached is a run that did not finish, and it says so. The
   * :05 run picks them up; this status is what makes it visible either way.
   */
  if (failed || unfinished || dropped) return NextResponse.json({ error: 'incomplete', ...summary }, { status: 503 });
  return NextResponse.json(summary);
}

type Signals = {
  studiedToday: boolean;
  streakToday: number;
  streakYesterday: number;
  awayDays: number;
  attempts: AttemptRow[];
  /** The name of the chapter they last answered a question in, ready to print. */
  lastChapter: string | null;
  planTicks: number;
  /** Titles and bodies of what they were sent in the last few days. */
  saidLately: string[];
  wantsReminder: boolean;
  wantsStreak: boolean;
  dayIndex: number;
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
  //    The plan has three tasks; this said five, so one tick read "4 left".
  if (s.planTicks > 0 && s.planTicks < PLAN_TASKS) return planUnfinished(PLAN_TASKS - s.planTicks);

  // 4. A chapter left halfway. The most concrete thing we can offer.
  if (s.lastChapter) return resumeChapter(s.lastChapter);

  // 5. Their genuinely worst topic, named, with the number. Not the same
  //    topic as the last few nights: by the third time it is wallpaper.
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
    if (worst?.topic && !s.saidLately.some((said) => said.includes(worst.topic))) return weakTopicNudge(worst.topic, worst.accuracy);
  }

  // 6. Nothing specific to say, so say something general, and a different
  //    something from last night.
  return comeBack(s.dayIndex);
}
