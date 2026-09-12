import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { AI_QUOTA, BOARD_LABEL, SUBJECTS, asBoard, type Board } from '@matricmate/core';
import { planIsActive } from '@/lib/entitlement';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * The one gate every AI route walks through: who is asking, do they have a
 * plan, and do they have quota left for what this operation costs.
 *
 * Costs are in quota units, the same 50-a-day pool the chat draws from. A
 * chat question is 1; building a practice set is 2; a whole mock paper is 3.
 * Heavier operations produce more tokens, so the pool stays an honest proxy
 * for spend while the student sees one simple number.
 */
export const AI_COST = { chat: 1, session: 2, check: 1, paper: 3, coach: 1, sheet: 1 } as const;

/**
 * All non-chat AI work runs on the same model as the tutor, chosen for the
 * quality/speed/cost balance. A separate constant so the two can diverge.
 */
export const AI_MODEL = 'claude-sonnet-5';

const TIMEZONE = 'Asia/Karachi';

/** Today's date key where the students are, not where the server is. */
export function dayKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date());
}

/** Monday of the current week in Pakistan, the coach's cache key. */
export function weekKey(): string {
  const pk = new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
  const day = (pk.getDay() + 6) % 7;
  pk.setDate(pk.getDate() - day);
  return `${pk.getFullYear()}-${String(pk.getMonth() + 1).padStart(2, '0')}-${String(pk.getDate()).padStart(2, '0')}`;
}

/** Next midnight in Pakistan, as an ISO instant the apps can render. */
export function resetAt(): string {
  const now = new Date();
  const pkNow = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));
  const pkMidnight = new Date(pkNow);
  pkMidnight.setHours(24, 0, 0, 0);
  return new Date(now.getTime() + (pkMidnight.getTime() - pkNow.getTime())).toISOString();
}

export type QuotaState = { limit: number; used: number; remaining: number; resetAt: string };

export type Guarded = {
  userId: string;
  admin: ReturnType<typeof createAdminClient>;
  quota: QuotaState;
  /** The caller's class from profiles.grade. Admin queries bypass RLS, so
   *  every AI route must filter by this itself or it would happily serve a
   *  grade-9 student class-10 material and defeat the one-class wall. */
  grade: 9 | 10;
  /** The caller's board from profiles.board, for the same reason: RLS keeps
   *  a Punjab student's reads to Punjab chapters, and admin queries skip RLS. */
  board: Board;
  /** The medium saved on the account, for a request that does not say which
   *  one it wants. Null when the account has never chosen. */
  medium: 'en' | 'ur' | null;
};

/** Not a decision about the student: the database did not answer. */
const unavailable = () => NextResponse.json({ error: 'server_error' }, { status: 503 });

/**
 * Runs the full gate. Returns the caller's identity and quota, or the exact
 * HTTP response to send back (401/402/429). Cookies for the website, a
 * bearer token for the app.
 */
export async function guardAi(req: NextRequest, cost: number): Promise<Guarded | NextResponse> {
  const g = await guardStudent(req);
  if (g instanceof NextResponse) return g;
  return quotaGate(g, cost) ?? g;
}

/**
 * Who is asking and whether they have a plan, without spending a thought on
 * quota yet.
 *
 * Split out for the one route that may answer for free: a cheat sheet another
 * student already paid for costs nothing, so a student who has used up the
 * day's allowance can still open one. Everything that calls the model goes
 * through `guardAi`, which is this plus `quotaGate`.
 */
export async function guardStudent(req: NextRequest): Promise<Guarded | NextResponse> {
  let userId: string | null = null;
  const admin = createAdminClient();

  const bearer = req.headers.get('authorization');
  if (bearer?.startsWith('Bearer ')) {
    const { data, error } = await admin.auth.getUser(bearer.slice(7));
    userId = !error && data.user ? data.user.id : null;
  } else {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  }
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const [ent, prof, usage] = await Promise.all([
    admin.from('entitlements').select('active,valid_till').eq('user_id', userId).maybeSingle(),
    admin.from('profiles').select('grade,role,board,onboarding').eq('id', userId).maybeSingle(),
    admin.from('ai_usage').select('used').eq('user_id', userId).eq('day', dayKey()).maybeSingle(),
  ]);

  /*
   * A failed read is not an answer. Treated as one, a timed-out entitlements
   * read told a paying student they had no plan, and a timed-out usage read
   * handed them a fresh allowance. Neither is theirs to be told.
   */
  if (ent.error || prof.error || usage.error) {
    console.error('[guard] read failed', (ent.error ?? prof.error ?? usage.error)?.message);
    return unavailable();
  }

  /*
   * Students only, checked before the plan.
   *
   * Every AI route in the app comes through here, so this is the one place it
   * needs saying. A page guard does not protect a route handler: these are
   * public HTTP endpoints, and a teacher's or an administrator's token is a
   * perfectly valid token. Today the plan check below would stop them anyway,
   * because staff accounts have no subscription, but that is a coincidence of
   * how things are rather than a rule, and it would stop being true the moment
   * anybody comped a staff account.
   */
  const role = prof.data?.role as string | null | undefined;
  if (role && role !== 'student') {
    return NextResponse.json({ error: 'not_a_student' }, { status: 403 });
  }

  if (!planIsActive(ent.data)) return NextResponse.json({ error: 'plan_required' }, { status: 402 });
  const grade: 9 | 10 = prof.data?.grade === 10 ? 10 : 9;
  const board = asBoard(prof.data?.board);
  const saved = (prof.data?.onboarding as { medium?: string } | null)?.medium;

  const used = (usage.data?.used as number | undefined) ?? 0;
  const limit = AI_QUOTA.premium;
  const quota: QuotaState = { limit, used, remaining: Math.max(0, limit - used), resetAt: resetAt() };

  return { userId, admin, quota, grade, board, medium: saved === 'ur' ? 'ur' : saved === 'en' ? 'en' : null };
}

/** The 429 for a student without `cost` left today, or null when they have it. */
export function quotaGate(g: Guarded, cost: number): NextResponse | null {
  if (g.quota.remaining < cost) {
    return NextResponse.json({ error: 'quota_exhausted', quota: g.quota }, { status: 429 });
  }
  return null;
}

/**
 * The student's reading medium for this request: what the app sent, or what
 * the account has saved when it sent nothing. Callers turn this into the
 * language of a particular subject with subjectMedium from core.
 */
export function studentMedium(sent: unknown, g: Pick<Guarded, 'medium'>): 'en' | 'ur' {
  if (sent === 'ur' || sent === 'en') return sent;
  return g.medium ?? 'en';
}

/** True when the database has not got charge_ai_usage yet (migration 0040). */
const missingFunction = (e: { code?: string; message?: string }) =>
  e.code === 'PGRST202' || e.code === '42883' || /charge_ai_usage/.test(e.message ?? '');

/**
 * Adds `cost` to today's count and returns the new total, or null when the
 * write failed.
 *
 * One statement in the database (charge_ai_usage, migration 0040), because the
 * old way lost charges: every route read `used` when the request arrived and
 * wrote back `used + cost` when it finished, so two requests in flight wrote
 * the same number, and a mock paper that took four minutes wrote back a count
 * from before anything else the student did in those four minutes. Both ends
 * handed quota back.
 *
 * Until 0040 is applied the function does not exist, and this falls back to
 * reading the count now and writing it straight back. Still a race, but one
 * round trip wide instead of a whole model call.
 */
export async function addUsage(admin: ReturnType<typeof createAdminClient>, userId: string, cost: number): Promise<number | null> {
  const day = dayKey();
  const { data, error } = await admin.rpc('charge_ai_usage', { p_user: userId, p_day: day, p_cost: cost });
  if (!error && typeof data === 'number') return data;
  if (error && !missingFunction(error)) {
    // Not retried: a failure after the database may have applied it could
    // charge the student twice. One uncounted answer is the better mistake.
    console.error('[quota] charge failed', error.message);
    return null;
  }

  const { data: row, error: readError } = await admin
    .from('ai_usage')
    .select('used')
    .eq('user_id', userId)
    .eq('day', day)
    .maybeSingle();
  if (readError) {
    console.error('[quota] charge read failed', readError.message);
    return null;
  }
  const used = ((row?.used as number | undefined) ?? 0) + cost;
  const { error: writeError } = await admin.from('ai_usage').upsert({ user_id: userId, day, used }, { onConflict: 'user_id,day' });
  if (writeError) {
    console.error('[quota] charge write failed', writeError.message);
    return null;
  }
  return used;
}

/** Charge after delivery, never before: a failed request costs nothing. */
export async function chargeQuota(g: Guarded, cost: number): Promise<QuotaState> {
  const used = (await addUsage(g.admin, g.userId, cost)) ?? g.quota.used + cost;
  return { ...g.quota, used, remaining: Math.max(0, g.quota.limit - used) };
}

type BlockRow = { kind: string; text?: string; term?: string; caption?: string; items?: string[] };

/** A chapter to write about, with or without our own text behind it. */
export type Grounding = {
  title: string;
  subjectId: string;
  /** Empty when `grounded` is false. */
  text: string;
  /** True when this is our published chapter text, false when the model must
   *  fall back on what it knows of the syllabus. */
  grounded: boolean;
};

/**
 * A chapter's sections flattened to plain text, the grounding for every
 * generation route. Capped so a long chapter cannot blow up the prompt.
 *
 * Null means the chapter is not the student's to write about: it does not
 * exist, or it belongs to another class or board. A read that failed throws,
 * so a slow database is not reported to the student as "not in your syllabus".
 */
export async function chapterGrounding(
  admin: ReturnType<typeof createAdminClient>,
  chapterId: string,
  /** The language of this subject for the student: subjectMedium in core. */
  medium: string,
  maxChars = 24_000,
  /** When given, a chapter from another class reads as not-found. */
  grade?: 9 | 10,
  /** When given, a chapter from another board reads as not-found. */
  board?: Board,
): Promise<Grounding | null> {
  const { data: chapter, error } = await admin
    .from('chapters')
    .select('id,title,subject_id,grade,board')
    .eq('id', chapterId)
    .maybeSingle();
  if (error) throw new Error(`chapter read failed: ${error.message}`);
  if (!chapter) return null;
  if (grade && chapter.grade !== grade) return null;
  if (board && asBoard(chapter.board) !== board) return null;

  const read = (m: string) =>
    admin
      .from('chapter_sections')
      .select('title,blocks')
      .eq('chapter_id', chapterId)
      .eq('medium', m)
      .eq('review_status', 'published')
      .order('position');
  let { data: sections, error: sectionsError } = await read(medium);
  if (!sectionsError && !sections?.length && medium !== 'en') {
    // Urdu grounding falls back to English rather than failing the request.
    ({ data: sections, error: sectionsError } = await read('en'));
  }
  if (sectionsError) throw new Error(`sections read failed: ${sectionsError.message}`);
  /*
   * No chapter text. This used to be the end of the request: the route
   * returned no_content, the app turned that into "something went wrong", and
   * a student sat looking at a chapter the app itself had offered them.
   *
   * Five Class 9 chapters are in that state (math-1, math-10, math-13, urd-4,
   * urd-5: written but never published), and math-1 is the first chapter of
   * Maths, so it is what the practice builder lands on by default. That is the
   * bug the client hit as "it only works one time".
   *
   * So we hand back the chapter without text and let the model work from what
   * it knows of the board syllabus instead. A generated question about
   * Matrices and Determinants is worth more to a student than an error, and
   * the alternative, hiding the chapter, is worse: it makes the syllabus look
   * incomplete. The draft rows are deliberately NOT used as a middle step;
   * they are placeholder scaffolding ("Detailed notes, ...") and would ground
   * the model in nothing.
   */
  if (!sections?.length) {
    return { title: chapter.title as string, subjectId: chapter.subject_id as string, text: '', grounded: false };
  }

  const parts: string[] = [];
  for (const s of sections) {
    parts.push(`## ${s.title}`);
    for (const b of (s.blocks as BlockRow[]) ?? []) {
      if (b.kind === 'def' && b.term) parts.push(`${b.term}: ${b.text ?? ''}`);
      else if (b.kind === 'list' && b.items) parts.push(b.items.map((i) => `- ${i}`).join('\n'));
      else if (b.kind === 'formula') parts.push(`Formula: ${b.text ?? ''}${b.caption ? ` (${b.caption})` : ''}`);
      else if (b.text) parts.push(b.text);
    }
  }
  return {
    title: chapter.title as string,
    subjectId: chapter.subject_id as string,
    text: parts.join('\n').slice(0, maxChars),
    grounded: true,
  };
}

/**
 * The chapter half of a prompt, written either way.
 *
 * Grounded, the model is pinned to our own text and may not wander. Ungrounded,
 * it is told plainly that there is no text and to work from the board syllabus,
 * and told just as plainly not to pretend otherwise: the failure mode to avoid
 * is a confident question about content this chapter does not actually contain.
 */
export function groundingBrief(g: Grounding, grade: 9 | 10, board: Board = 'fbise'): string {
  if (g.grounded) return `Chapter: ${g.title}\n${g.text}`;
  const subject = SUBJECTS.find((s) => s.id === g.subjectId)?.name ?? g.subjectId;
  return (
    `Chapter: ${g.title} (${subject}, ${BOARD_LABEL[board]} Class ${grade}).\n` +
    'There is no chapter text available for this one, so work from your own knowledge of what the ' +
    `${BOARD_LABEL[board]} Class ${grade} syllabus covers under this chapter title. Stay inside that scope: no topic ` +
    'that belongs to another chapter, and nothing beyond this class. Keep to the standard, ' +
    'uncontroversial content every textbook for this chapter covers, and do not invent board ' +
    'policies, mark distributions or quotations from a textbook you cannot see.'
  );
}

/**
 * How a route answers a model refusal.
 *
 * Not 200. The apps' shared client treats any 2xx as a result, so a refusal
 * sent with 200 went on as one: an MCQ build threw inside the click handler, a
 * mock paper opened `?id=undefined`, and the answer checker crashed the short
 * question screen. 422 is "understood, but not something we can produce".
 */
export const refused = (quota: QuotaState) => NextResponse.json({ error: 'refused', quota }, { status: 422 });
