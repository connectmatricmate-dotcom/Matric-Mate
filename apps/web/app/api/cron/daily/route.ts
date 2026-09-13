import { NextRequest, NextResponse } from 'next/server';
import { subjectMedium, translate } from '@matricmate/core';
import type { Language } from '@matricmate/core';
import { planIsActive } from '@/lib/entitlement';
import { createAdminClient } from '@/lib/supabase/admin';
import { examTip, notify, recall } from '@/lib/notify';
import type { Notice, Recipient } from '@/lib/notify';
import { JobError, chunks, cronAuthorised, eachLimited, pageAll, withRetry } from '@/lib/notify/jobs';

/**
 * The afternoon message: one thing worth knowing, from the student's own
 * syllabus, every day.
 *
 * The evening nudge asks a student to come and study. This one gives them
 * something before they have done anything: a flashcard from a chapter in
 * their own class, board and subjects, question and answer together, or an
 * exam tip for one of their subjects. Worth reading even if it is never
 * opened, which is what keeps a daily message from turning into noise.
 *
 * 14:00 in Karachi, after school and well before the evening nudge, which
 * starts at 16:00 at the earliest. Everybody with the study reminder switched
 * on gets it, with or without a plan. Without one they get the tip only: the
 * flashcards are what a plan pays for, and a tap would only reach the upgrade
 * screen.
 *
 * Once a day each, guaranteed by profiles.tip_sent_on, which is written before
 * anything is sent: a second run (pg_cron calls this again at :05) only reaches
 * the students the first one could not claim.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_PER_RUN = 500;
const CONCURRENCY = 8;
const BUDGET_MS = 100_000;
/** Long enough for a real question and answer, short enough for a notification. */
const FRONT_MAX = 110;
const BACK_MAX = 200;
/** Chapters count as theirs when they answered something in them this recently. */
const STUDIED_DAYS = 60;

type ProfileRow = { id: string; settings: unknown; onboarding: unknown; grade: number | null };
type Onboarding = { board?: string; classLevel?: number; subjects?: string[]; medium?: string };
type ChapterRow = { id: string; subject_id: string; board: string; grade: number; number: number };

const karachiDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(d);

/** A small, stable number per student, so two students on the same day do not get the same card. */
const seed = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
};

export async function GET(req: NextRequest) {
  if (!cronAuthorised(req)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  try {
    // `?dry=1` works out every student's message and returns it, sending,
    // claiming and recording nothing. For checking a change against real data.
    // `&shift=1` previews tomorrow's, `&shift=2` the day after.
    const dry = req.nextUrl.searchParams.get('dry') === '1';
    const shift = dry ? Number(req.nextUrl.searchParams.get('shift') ?? 0) || 0 : 0;
    return await run(dry, shift);
  } catch (e) {
    console.error('[cron/daily] run failed', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: 'incomplete', stage: e instanceof JobError ? e.stage : 'unknown', detail: e instanceof Error ? e.message : String(e) },
      { status: 503 },
    );
  }
}

async function run(dry: boolean, shift = 0): Promise<NextResponse> {
  const startedAt = Date.now();
  const admin = createAdminClient();
  const now = new Date();
  const today = karachiDay(now);
  const dayIndex = Math.floor(now.getTime() / 864e5) + shift;

  const profiles = await pageAll<ProfileRow>('profiles', (from, to, signal) =>
    admin.from('profiles').select('id,settings,onboarding,grade').eq('role', 'student').order('id').range(from, to).abortSignal(signal),
  );
  // Absent means never touched, and it defaults to on. Only an explicit false is a no.
  const wanting = profiles.filter((p) => ((p.settings ?? {}) as Record<string, unknown>).reminders !== false);
  if (!wanting.length) return NextResponse.json({ considered: 0, sent: 0 });

  /*
   * Claimed before anything goes out, a slice at a time, and only the rows
   * not already stamped today come back. A double-fired run gets an empty
   * list instead of sending the day's message twice.
   */
  const claimed = new Set<string>(dry ? wanting.slice(0, MAX_PER_RUN).map((p) => p.id) : []);
  for (const slice of dry ? [] : chunks(wanting.map((p) => p.id))) {
    if (claimed.size >= MAX_PER_RUN) break;
    const { data, error } = await withRetry((signal) =>
      admin
        .from('profiles')
        .update({ tip_sent_on: today })
        .in('id', slice.slice(0, MAX_PER_RUN - claimed.size))
        .or(`tip_sent_on.is.null,tip_sent_on.neq.${today}`)
        .select('id')
        .abortSignal(signal),
    );
    if (error) throw new JobError('claim', error.message);
    for (const r of (data ?? []) as { id: string }[]) claimed.add(r.id);
  }
  const batch = wanting.filter((p) => claimed.has(p.id));
  if (!batch.length) return NextResponse.json({ considered: 0, sent: 0 });
  const ids = batch.map((p) => p.id);

  const readIds = async <Row,>(stage: string, page: (slice: string[], from: number, to: number, signal: AbortSignal) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>) => {
    const out: Row[] = [];
    for (const slice of chunks(ids)) out.push(...(await pageAll<Row>(stage, (from, to, signal) => page(slice, from, to, signal))));
    return out;
  };

  const [plans, studied, chapters, subjects] = await Promise.all([
    readIds<{ user_id: string; active: boolean | null; valid_till: string | null }>('entitlements', (slice, from, to, signal) =>
      admin.from('entitlements').select('user_id,active,valid_till').in('user_id', slice).order('user_id').range(from, to).abortSignal(signal),
    ),
    readIds<{ user_id: string; chapter_id: string }>('attempts', (slice, from, to, signal) =>
      admin
        .from('attempts')
        .select('user_id,chapter_id')
        .in('user_id', slice)
        .gte('at', new Date(now.getTime() - STUDIED_DAYS * 864e5).toISOString())
        .order('id')
        .range(from, to)
        .abortSignal(signal),
    ),
    pageAll<ChapterRow>('chapters', (from, to, signal) =>
      admin.from('chapters').select('id,subject_id,board,grade,number').eq('review_status', 'published').order('id').range(from, to).abortSignal(signal),
    ),
    pageAll<{ id: string; name: string; urdu_name: string | null; compulsory: boolean }>('subjects', (from, to, signal) =>
      admin.from('subjects').select('id,name,urdu_name,compulsory,sort_order').order('sort_order').range(from, to).abortSignal(signal),
    ),
  ]);

  const paying = new Set(plans.filter(planIsActive).map((e) => e.user_id));
  const studiedByUser = new Map<string, Set<string>>();
  for (const r of studied) studiedByUser.set(r.user_id, (studiedByUser.get(r.user_id) ?? new Set()).add(r.chapter_id));
  const subjectById = new Map(subjects.map((r) => [r.id, r]));
  /** For a student who never finished setting up: the subjects every student takes. */
  const compulsory = subjects.filter((r) => r.compulsory).map((r) => r.id);

  const stopAt = startedAt + BUDGET_MS;
  let sent = 0;
  let failed = 0;
  let pushed = 0;
  let pushFailed = 0;
  const picked: Record<string, number> = {};
  const preview: { user: string; paying: boolean; title: string; body: string; target: string }[] = [];

  const reached = await eachLimited(
    batch,
    CONCURRENCY,
    async (profile) => {
      const settings = (profile.settings ?? {}) as Record<string, unknown>;
      const onboarding = (profile.onboarding ?? {}) as Onboarding;
      const lang: Language = onboarding.medium === 'ur' ? 'ur' : 'en';
      const board = onboarding.board === 'punjab' ? 'punjab' : 'fbise';
      // The class on the profile when setup never saved one.
      const grade = (onboarding.classLevel ?? profile.grade) === 10 ? 10 : 9;
      const s = seed(profile.id);
      // Counts up one a day, from a different starting point for each student.
      const turn = dayIndex + s;

      /*
       * Their subjects that actually have chapters for their board and class.
       * An empty list (onboarding never finished) still gets a general tip.
       */
      const ownChapters = chapters.filter((c) => c.board === board && c.grade === grade);
      const chosen = Array.isArray(onboarding.subjects) && onboarding.subjects.length ? onboarding.subjects : compulsory;
      const list = chosen.filter((id) => ownChapters.some((c) => c.subject_id === id));
      const subjectId = list.length ? list[Math.floor(turn / 2) % list.length] : null;
      const subjectRow = subjectId ? subjectById.get(subjectId) : undefined;
      const subjectLabel = subjectRow ? (lang === 'ur' && subjectRow.urdu_name) || subjectRow.name : '';

      let notice: Notice | null = null;

      // Every other day a flashcard, for a student with a plan and a subject to draw from.
      if (paying.has(profile.id) && subjectId && turn % 2 === 0) {
        const inSubject = ownChapters.filter((c) => c.subject_id === subjectId).sort((a, b) => a.number - b.number);
        // Chapters they have worked in first: recall of something studied is
        // revision, recall of a chapter never opened is a quiz they cannot pass.
        const mine = inSubject.filter((c) => studiedByUser.get(profile.id)?.has(c.id));
        const pool = mine.length ? mine : inSubject.slice(0, 3);
        const chapter = pool[turn % pool.length];
        if (chapter) {
          const medium = subjectMedium(chapter.id, board, onboarding.medium === 'ur' ? 'ur' : 'en');
          const { data } = await withRetry((signal) =>
            admin
              .from('flashcards')
              .select('front,back')
              .eq('chapter_id', chapter.id)
              .eq('medium', medium)
              .eq('review_status', 'published')
              .order('id')
              .limit(80)
              .abortSignal(signal),
          );
          const cards = ((data ?? []) as { front: string; back: string }[]).filter(
            (c) => c.front.length <= FRONT_MAX && c.back.length <= BACK_MAX,
          );
          const card = cards[Math.floor(turn / 2) % Math.max(cards.length, 1)];
          if (card) notice = recall(subjectLabel, card.front.trim(), card.back.trim(), chapter.id);
        }
      }

      // Otherwise, or when that chapter had no card short enough, an exam tip.
      // A tip every day for a student who gets no flashcards, every other day
      // for one who does, so the count of tips they have had is not the same.
      const tipTurn = paying.has(profile.id) && subjectId ? Math.floor(turn / 2) : turn;
      notice ??= examTip(subjectId, subjectLabel, tipTurn, paying.has(profile.id) ? 'study' : 'home');

      if (dry) {
        preview.push({
          user: profile.id.slice(0, 8),
          paying: paying.has(profile.id),
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
      const report = await notify(recipient, notice);
      if (report.inbox === 'sent') {
        sent++;
        const label = notice.title === 'notifications.recallTitle' ? 'recall' : 'tip';
        picked[label] = (picked[label] ?? 0) + 1;
      } else failed++;
      if (report.push === 'sent') pushed++;
      else if (report.push === 'failed' || report.push === 'unconfigured') pushFailed++;
    },
    () => Date.now() > stopAt,
  );

  /*
   * A student claimed but not reached keeps today's stamp and misses today's
   * message. That is the trade the claim makes: a missed tip is a small loss,
   * the same one twice is the kind of thing that gets notifications turned off.
   */
  if (dry) return NextResponse.json({ dry: true, considered: batch.length, preview });
  const unfinished = batch.length - reached;
  const summary = { considered: batch.length, sent, failed, pushed, pushFailed, unfinished, picked };
  if (failed || pushFailed || unfinished) return NextResponse.json({ error: 'incomplete', ...summary }, { status: 503 });
  return NextResponse.json(summary);
}
