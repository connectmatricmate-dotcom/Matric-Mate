import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { AI_QUOTA, SUBJECTS } from '@matricmate/core';
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
};

/**
 * Runs the full gate. Returns the caller's identity and quota, or the exact
 * HTTP response to send back (401/402/429). Cookies for the website, a
 * bearer token for the app.
 */
export async function guardAi(req: NextRequest, cost: number): Promise<Guarded | NextResponse> {
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

  const [{ data: ent }, { data: prof }] = await Promise.all([
    admin.from('entitlements').select('active,valid_till').eq('user_id', userId).maybeSingle(),
    admin.from('profiles').select('grade').eq('id', userId).maybeSingle(),
  ]);
  const entitled = !!ent?.active && (!ent.valid_till || Date.parse(ent.valid_till) > Date.now());
  if (!entitled) return NextResponse.json({ error: 'plan_required' }, { status: 402 });
  const grade: 9 | 10 = prof?.grade === 10 ? 10 : 9;

  const { data: usage } = await admin
    .from('ai_usage')
    .select('used')
    .eq('user_id', userId)
    .eq('day', dayKey())
    .maybeSingle();
  const used = usage?.used ?? 0;
  const limit = AI_QUOTA.premium;
  const quota: QuotaState = { limit, used, remaining: Math.max(0, limit - used), resetAt: resetAt() };
  if (quota.remaining < cost) {
    return NextResponse.json({ error: 'quota_exhausted', quota }, { status: 429 });
  }

  return { userId, admin, quota, grade };
}

/** Charge after delivery, never before: a failed request costs nothing. */
export async function chargeQuota(g: Guarded, cost: number): Promise<QuotaState> {
  await g.admin
    .from('ai_usage')
    .upsert({ user_id: g.userId, day: dayKey(), used: g.quota.used + cost }, { onConflict: 'user_id,day' });
  return {
    ...g.quota,
    used: g.quota.used + cost,
    remaining: Math.max(0, g.quota.remaining - cost),
  };
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
 */
export async function chapterGrounding(
  admin: ReturnType<typeof createAdminClient>,
  chapterId: string,
  medium: string,
  maxChars = 24_000,
  /** When given, a chapter from another class reads as not-found. */
  grade?: 9 | 10,
): Promise<Grounding | null> {
  const { data: chapter } = await admin
    .from('chapters')
    .select('id,title,subject_id,grade')
    .eq('id', chapterId)
    .maybeSingle();
  if (!chapter) return null;
  if (grade && chapter.grade !== grade) return null;

  let { data: sections } = await admin
    .from('chapter_sections')
    .select('title,blocks')
    .eq('chapter_id', chapterId)
    .eq('medium', medium)
    .eq('review_status', 'published')
    .order('position');
  if (!sections?.length && medium !== 'en') {
    // Urdu grounding falls back to English rather than failing the request.
    ({ data: sections } = await admin
      .from('chapter_sections')
      .select('title,blocks')
      .eq('chapter_id', chapterId)
      .eq('medium', 'en')
      .eq('review_status', 'published')
      .order('position'));
  }
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
export function groundingBrief(g: Grounding, grade: 9 | 10): string {
  if (g.grounded) return `Chapter: ${g.title}\n${g.text}`;
  const subject = SUBJECTS.find((s) => s.id === g.subjectId)?.name ?? g.subjectId;
  return (
    `Chapter: ${g.title} (${subject}, FBISE Class ${grade}).\n` +
    'There is no chapter text available for this one, so work from your own knowledge of what the ' +
    `FBISE Class ${grade} syllabus covers under this chapter title. Stay inside that scope: no topic ` +
    'that belongs to another chapter, and nothing beyond this class. Keep to the standard, ' +
    'uncontroversial content every textbook for this chapter covers, and do not invent board ' +
    'policies, mark distributions or quotations from a textbook you cannot see.'
  );
}
