import { NextRequest, NextResponse } from 'next/server';
import { reminderHour, translate, weakTopics } from '@matricmate/core';
import type { Attempt, Language } from '@matricmate/core';
import { planIsActive } from '@/lib/entitlement';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  awayFor,
  awaySubject,
  bestDay,
  comeBack,
  keepGoing,
  moreSet,
  moreToday,
  notify,
  planDone,
  planUnfinished,
  resumeChapter,
  startSubject,
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
 * nothing specific applies. Even that fallback rotates through eight wordings
 * and their own subjects.
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
 * How far back "days since they last studied" is counted. Past this it only
 * matters that it is a long time: every student with a plan and reminders on
 * hears from us every evening, however long they have been away. This used to
 * be a cut-off, and three weeks of silence was exactly when a student who had
 * drifted off needed a reason to come back.
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
/** Past this many questions short of their best day, the gap reads as a scold rather than a target. */
const MAX_GAP = 30;
/** Enough questions for "best day this week" to be worth saying. */
const BEST_DAY_MIN = 10;

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
    /*
     * `?dry=1` works out tonight's message for everyone due and returns it,
     * sending and recording nothing, and ignoring who was already nudged.
     * `&hour=19` previews another hour's students.
     */
    const params = req.nextUrl.searchParams;
    const dry = params.get('dry') === '1';
    const hour = dry && params.get('hour') ? Number(params.get('hour')) : null;
    return await run(dry, Number.isInteger(hour) ? hour : null);
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

async function run(dry = false, hourOverride: number | null = null): Promise<NextResponse> {
  const startedAt = Date.now();
  const admin = createAdminClient();
  const now = new Date();
  const today = karachiDay(now);
  const yesterday = new Date(now.getTime() - 864e5);
  /** Rotates the general nudge, so it is a different sentence each night. */
  const dayIndex = Math.floor(now.getTime() / 864e5);
  const hourNow =
    hourOverride ?? Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', hour12: false }).format(now));

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
  const plans = await forIds<{ user_id: string; active: boolean | null; valid_till: string | null; plan: string | null; trial_subject: string | null }>(
    'entitlements',
    dueHour.map((p) => p.id),
    (slice, from, to, signal) =>
      admin
        .from('entitlements')
        .select('user_id,active,valid_till,plan,trial_subject')
        .in('user_id', slice)
        .order('user_id')
        .range(from, to)
        .abortSignal(signal),
  );
  const paying = new Set(plans.filter(planIsActive).map((e) => e.user_id));
  /* A free trial opens one subject, so that is the only one to name: a
     reminder to pick up Chemistry is a tap on a locked door. */
  const trialOf = new Map(
    plans.filter((e) => planIsActive(e) && e.plan === 'trial' && e.trial_subject).map((e) => [e.user_id, e.trial_subject as string]),
  );
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
  const pending = dry ? due : due.filter((p) => !already.has(p.id));
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
   * Everyone due this hour: the active, the ones who have drifted off, and the
   * ones who have never studied at all.
   *
   * The last group used to be invisible, because this list was built from
   * active_days and a student with no activity has no rows in it. Then both
   * of the other two were cut off after three weeks. A student who stopped
   * got three messages and then nothing, and one who signed up and never
   * started got three weeks of them. Now nobody drops out while their plan
   * and their reminder switch are on.
   */
  const candidates = batch.map((p) => {
    const days = daysByUser.get(p.id) ?? new Set<string>();
    return { profile: p, days, neverStarted: days.size === 0 };
  });
  const ids = candidates.map((c) => c.profile.id);

  /*
   * Attempts only for the students whose message could depend on them:
   * someone who studied today or never has gets a message that does not.
   * Oldest first, so the last row per student really is their latest; this
   * read had no order, and "the chapter they left halfway" was whichever row
   * the database happened to return last.
   */
  const needAttempts = candidates.filter((c) => !c.neverStarted && !c.days.has(today)).map((c) => c.profile.id);
  /*
   * For the ones who studied today, only how many questions they answered on
   * each of the last seven days: tonight's message is about today against
   * the best day this week, and the rest of their history cannot change it.
   */
  const studiedToday = candidates.filter((c) => c.days.has(today)).map((c) => c.profile.id);
  const [attemptRows, planRows, weekRows, subjectRows] = await Promise.all([
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
    forIds<{ user_id: string; at: string }>('attempts-week', studiedToday, (slice, from, to, signal) =>
      admin
        .from('attempts')
        .select('user_id,at')
        .in('user_id', slice)
        .gte('at', new Date(now.getTime() - 7 * 864e5).toISOString())
        .order('id')
        .range(from, to)
        .abortSignal(signal),
    ),
    pageAll<{ id: string; name: string; urdu_name: string | null; compulsory: boolean }>('subjects', (from, to, signal) =>
      admin.from('subjects').select('id,name,urdu_name,compulsory,sort_order').order('sort_order').range(from, to).abortSignal(signal),
    ),
  ]);

  /** Questions answered per Karachi day this week, per student who studied today. */
  const weekByUser = new Map<string, Map<string, number>>();
  for (const r of weekRows) {
    const perDay = weekByUser.get(r.user_id) ?? new Map<string, number>();
    const day = karachiDay(new Date(r.at));
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
    weekByUser.set(r.user_id, perDay);
  }
  const subjectById = new Map(subjectRows.map((r) => [r.id, r]));
  /** For a student who never finished setting up: the subjects every student takes. */
  const compulsory = subjectRows.filter((r) => r.compulsory).map((r) => r.id);

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
  /** What reached a phone, which the inbox count above says nothing about. */
  let pushed = 0;
  let pushFailed = 0;
  const picked: Record<string, number> = {};
  const preview: { user: string; title: string; body: string; target: string }[] = [];

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
      const perDay = weekByUser.get(profile.id);
      const bestBefore = perDay ? Math.max(0, ...[...perDay].filter(([d]) => d !== today).map(([, n]) => n)) : 0;
      /*
       * The subject to name for a student who has been away: the one they last
       * worked in, else the first on their list. Rotated by day through their
       * list when there is no history, so it is not Mathematics every time.
       */
      const onboarding = (profile.onboarding ?? {}) as { subjects?: string[] };
      const list = Array.isArray(onboarding.subjects) && onboarding.subjects.length ? onboarding.subjects : compulsory;
      // Offset per student, so a whole class is not sent the same subject on the same night.
      const offset = [...profile.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 0);
      const subjectId =
        trialOf.get(profile.id) ?? last?.subject_id ?? (list.length ? list[Math.abs(dayIndex + offset) % list.length] : undefined);
      const subjectRow = subjectId ? subjectById.get(subjectId) : undefined;
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
        lastChapterId: chapter?.id ?? null,
        subject: subjectRow ? (lang === 'ur' && subjectRow.urdu_name) || subjectRow.name : null,
        todayCount: perDay?.get(today) ?? 0,
        bestBefore,
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
      if (dry) {
        preview.push({
          user: profile.id.slice(0, 8),
          title: translate(lang, notice.title, notice.params),
          body: translate(lang, notice.body, notice.params),
          target: notice.target === 'chapter' ? `chapter:${notice.chapterId}` : (notice.target ?? 'home'),
        });
        return;
      }
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
      if (report.push === 'sent') pushed++;
      else if (report.push === 'failed' || report.push === 'unconfigured') pushFailed++;
    },
    () => Date.now() > stopAt,
  );

  if (dry) return NextResponse.json({ dry: true, hour: hourNow, considered: candidates.length, preview });
  const unfinished = candidates.length - reached;
  // The breakdown is the point of the logging: if every student is getting the
  // same generic nudge, the picker is not doing its job and that shows here.
  const summary = { hour: hourNow, considered: candidates.length, sent, failed, pushed, pushFailed, unfinished, dropped, picked };
  /*
   * Anyone not reached is a run that did not finish, and it says so. The
   * :05 run picks them up; this status is what makes it visible either way.
   * A push that could not go out counts too: for a month every one of them
   * failed at the login to Firebase while this answered 200.
   */
  if (failed || pushFailed || unfinished || dropped) return NextResponse.json({ error: 'incomplete', ...summary }, { status: 503 });
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
  lastChapterId: string | null;
  /** One of their subjects, named in their language, for a student who has been away. */
  subject: string | null;
  /** Questions answered today, and on their best other day in the last week. */
  todayCount: number;
  bestBefore: number;
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
 *
 * Everybody with the reminder switch on gets something every evening. A
 * student who has already studied is told something true about their day and
 * given a reason to do a little more; one who has not is given a reason to
 * start, however long it has been.
 */
function pick(s: Signals): Notice | null {
  if (s.studiedToday) {
    // A streak reached is the one piece of news that beats everything.
    if (s.wantsStreak && MILESTONES.includes(s.streakToday)) return streakMilestone(s.streakToday);
    if (!s.wantsReminder) return null;
    // Today already beats the rest of the week, and by enough to mention.
    if (s.todayCount >= BEST_DAY_MIN && s.todayCount > s.bestBefore) return bestDay(s.todayCount);
    if (s.planTicks >= PLAN_TASKS) return planDone();
    // Started today's plan and left it. The plan has three tasks.
    if (s.planTicks > 0) return planUnfinished(PLAN_TASKS - s.planTicks);
    // Read or listened, but answered nothing.
    if (s.todayCount === 0) return keepGoing();
    // Close enough to their best day to make it a target; past that, just one more set.
    const gap = s.bestBefore - s.todayCount + 1;
    return gap > 0 && gap <= MAX_GAP ? moreToday(s.todayCount, gap) : moreSet(s.todayCount);
  }

  // 1. A live streak, tonight, with hours left to save it.
  if (s.wantsStreak && s.streakYesterday >= 2) return streakAtRiskTiered(s.streakYesterday);

  if (!s.wantsReminder) return null;

  /*
   * Never studied. The rotating general nudge, with one of their own subjects
   * named every third evening, before the ladder below: "away for 7 days" is
   * measured from a visit they never made.
   */
  if (s.neverStarted) return s.subject && s.dayIndex % 3 === 0 ? startSubject(s.subject) : comeBack(s.dayIndex);

  // 2. Gone for exactly three, seven or fourteen days: the win-back rungs.
  const rung = awayFor(s.awayDays);
  if (rung) return rung;

  // 3. Today's plan, started and abandoned. Only when they actually began it:
  //    "3 tasks left" to someone who never opened the app reads as a scold.
  if (s.planTicks > 0 && s.planTicks < PLAN_TASKS) return planUnfinished(PLAN_TASKS - s.planTicks);

  // 4. A chapter left halfway, while it is still fresh, and not the same
  //    chapter as the last few nights.
  if (s.lastChapter && s.awayDays <= 7 && !s.saidLately.some((said) => said.includes(s.lastChapter!))) {
    return resumeChapter(s.lastChapter, s.lastChapterId ?? undefined);
  }

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
  //    something from last night: one of their subjects every third evening,
  //    the rotating pool on the others.
  return s.subject && s.dayIndex % 3 === 0 ? awaySubject(s.subject) : comeBack(s.dayIndex);
}
