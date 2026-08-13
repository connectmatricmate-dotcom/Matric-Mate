import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { AI_QUOTA, SUBJECTS } from '@matricmate/core';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * The tutor, for real. One route serves both apps: the website calls it with
 * its session cookies, the Android app with a Supabase access token in the
 * Authorization header. The Anthropic key exists only here, server-side;
 * nothing shippable ever carries it.
 *
 * Every wall a student can hit is enforced HERE, not in the apps, because a
 * client-side counter is a suggestion and this is a bill:
 *  - no active plan: 402
 *  - 50 questions per day (Asia/Karachi days, because that is where every
 *    student lives): 429 with the reset time
 *  - 5 questions per minute, the actual abuse wall: 429 with retry hint
 *
 * The model choice is one constant. claude-sonnet-5 because a tutor for
 * fourteen-year-olds must be genuinely good in both English and Urdu and
 * still answer in a few seconds; at roughly two rupees an answer against a
 * thousand-rupee subscription the economics hold. If quality ever needs a
 * step up, claude-opus-5 is a one-word change here and a deploy.
 */
const TUTOR_MODEL = 'claude-sonnet-5';
// Sonnet 5 thinks adaptively by default and max_tokens caps thinking PLUS the
// visible answer, so this needs headroom or a hard numerical would truncate
// mid-solution. The answers themselves stay short; the prompt sees to that.
const MAX_ANSWER_TOKENS = 6000;
const HISTORY_TURNS = 12;
const RATE_LIMIT_PER_MINUTE = 5;
const TIMEZONE = 'Asia/Karachi';

export const maxDuration = 60;

const anthropic = new Anthropic();

/** Today's date key where the students are, not where the server is. */
function dayKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date());
}

/** Next midnight in Pakistan, as an ISO instant the apps can render. */
function resetAt(): string {
  const now = new Date();
  const pkNow = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));
  const pkMidnight = new Date(pkNow);
  pkMidnight.setHours(24, 0, 0, 0);
  return new Date(now.getTime() + (pkMidnight.getTime() - pkNow.getTime())).toISOString();
}

/**
 * Who is calling. Cookies for the website, a bearer token for the app.
 */
async function authenticate(req: NextRequest): Promise<string | null> {
  const bearer = req.headers.get('authorization');
  if (bearer?.startsWith('Bearer ')) {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.getUser(bearer.slice(7));
    if (!error && data.user) return data.user.id;
    return null;
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

type QuotaState = { limit: number; used: number; remaining: number; resetAt: string };

async function readQuota(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<QuotaState> {
  const { data } = await admin.from('ai_usage').select('used').eq('user_id', userId).eq('day', dayKey()).maybeSingle();
  const used = data?.used ?? 0;
  const limit = AI_QUOTA.premium;
  return { limit, used, remaining: Math.max(0, limit - used), resetAt: resetAt() };
}

/**
 * The teacher's standing knowledge: persona plus the board's own weighting
 * of every chapter, so "is this chapter important?" gets the real number.
 *
 * Deliberately identical bytes on every request, and marked as a cache
 * breakpoint: Anthropic then serves it from prompt cache at a tenth of the
 * price. The per-student block goes AFTER this, never inside it.
 */
let weightageDigest: string | null = null;

async function buildStandingContext(admin: ReturnType<typeof createAdminClient>): Promise<string> {
  if (weightageDigest) return weightageDigest;
  const { data } = await admin
    .from('chapters')
    .select('id,subject_id,number,title,exam_share,exam_marks')
    .eq('review_status', 'published')
    .order('subject_id')
    .order('number');
  const bySubject = new Map<string, string[]>();
  for (const c of data ?? []) {
    const line = `${c.number}. ${c.title}${c.exam_share ? ` (${c.exam_share}% of the paper${c.exam_marks ? `, ~${c.exam_marks} marks` : ''})` : ''}`;
    const list = bySubject.get(c.subject_id) ?? [];
    list.push(line);
    bySubject.set(c.subject_id, list);
  }
  const parts: string[] = [];
  for (const s of SUBJECTS) {
    const lines = bySubject.get(s.id);
    if (lines?.length) parts.push(`${s.name}:\n${lines.join('\n')}`);
  }
  weightageDigest = parts.join('\n\n');
  return weightageDigest;
}

const PERSONA = `You are the MatricMate tutor: a warm, patient teacher for FBISE Class 9 students in Pakistan (SSC Part 1, the 2022-23 National Curriculum assessment framework).

How you teach:
- Answer like a good teacher at a whiteboard: short direct answer first, then the steps that get there. Numbered steps for numericals and derivations.
- Match the student's language. If they write in Urdu or Roman Urdu, answer in the same register; keep technical terms in English either way, the way Pakistani classrooms do.
- Ground answers in the FBISE syllabus and the chapter weightings provided below. When a student asks what matters for the exam, use the board's real percentages.
- Exam craft counts: point out what examiners award marks for, common mistakes, and how many marks a question of this kind usually carries.
- Keep answers tight. A focused answer a student finishes beats a lecture they abandon. No filler, no repeated caveats.
- If a question is outside Class 9 study (other classes are fine to touch briefly when they help), gently steer back to the syllabus. You are a study tutor, not a general assistant: politely decline requests unrelated to studying.
- Use web search only when the question genuinely needs current information (board dates, notifications, recent changes); the syllabus itself you already know.
- Never invent board policies, dates or marks distributions. If unsure, say so and suggest checking fbise.edu.pk.
- Write in plain text: short paragraphs and numbered lists only. No markdown headings, no asterisks or bold markers, no tables, no LaTeX. Write fractions with / and powers with ^, the way they are typed in class notes.
- Never use an em dash. Use a comma, a colon, or a new sentence instead.

Chapter weightage from the board's assessment frameworks (share of the annual paper):

`;

export async function POST(req: NextRequest) {
  const userId = await authenticate(req);
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const admin = createAdminClient();

  // Paid-only: the same wall RLS enforces on content, applied to the tutor.
  const { data: ent } = await admin
    .from('entitlements')
    .select('active,valid_till')
    .eq('user_id', userId)
    .maybeSingle();
  const entitled = !!ent?.active && (!ent.valid_till || Date.parse(ent.valid_till) > Date.now());
  if (!entitled) return NextResponse.json({ error: 'plan_required' }, { status: 402 });

  const quota = await readQuota(admin, userId);
  if (quota.remaining <= 0) {
    return NextResponse.json({ error: 'quota_exhausted', quota }, { status: 429 });
  }

  // The abuse wall: a human student cannot ask five thoughtful questions in
  // a minute; a script can. Counted from persisted messages, so it cannot be
  // reset by reinstalling the app.
  const { count: lastMinute } = await admin
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('role', 'user')
    .gte('at', new Date(Date.now() - 60_000).toISOString());
  if ((lastMinute ?? 0) >= RATE_LIMIT_PER_MINUTE) {
    return NextResponse.json({ error: 'rate_limited', quota }, { status: 429 });
  }

  let body: {
    message?: string;
    threadId?: string;
    context?: string;
    profile?: { name?: string; medium?: string; language?: string; subjects?: string[]; weakTopics?: string[] };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const message = (body.message ?? '').trim().slice(0, 4000);
  if (!message) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  // Thread: reuse if owned, else start one named after the question.
  let threadId = body.threadId ?? null;
  if (threadId) {
    const { data: owned } = await admin.from('chat_threads').select('id').eq('id', threadId).eq('user_id', userId).maybeSingle();
    if (!owned) threadId = null;
  }
  if (!threadId) {
    const title = message.length > 42 ? `${message.slice(0, 42)}…` : message;
    const { data: created, error: tErr } = await admin
      .from('chat_threads')
      .insert({ user_id: userId, title, context_label: body.context?.slice(0, 120) ?? null })
      .select('id')
      .single();
    if (tErr || !created) return NextResponse.json({ error: 'server_error' }, { status: 500 });
    threadId = created.id;
  }

  // History, oldest first, trimmed to keep the request lean.
  const { data: historyRows } = await admin
    .from('chat_messages')
    .select('role,content')
    .eq('thread_id', threadId)
    .order('at', { ascending: true })
    .limit(HISTORY_TURNS);

  const profile = body.profile ?? {};
  const studentBlock = [
    'About this student:',
    profile.name ? `- Name: ${profile.name}` : null,
    `- Study medium: ${profile.medium === 'ur' ? 'Urdu' : 'English'}`,
    profile.language === 'ur' ? '- App language: Urdu (Roman Urdu is natural for them)' : null,
    profile.subjects?.length ? `- Their subjects: ${profile.subjects.join(', ')}` : null,
    profile.weakTopics?.length ? `- Topics they have been getting wrong lately: ${profile.weakTopics.join(', ')}` : null,
    body.context ? `- They are asking from: ${body.context.slice(0, 300)}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const standing = await buildStandingContext(admin);

  try {
    const turns: Anthropic.MessageParam[] = [
      ...(historyRows ?? []).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: message },
    ];
    const ask = () =>
      anthropic.messages.create({
        model: TUTOR_MODEL,
        max_tokens: MAX_ANSWER_TOKENS,
        output_config: { effort: 'low' },
        system: [
          // Stable bytes first with the cache breakpoint, volatile student
          // block after it, so the big block caches across every student.
          { type: 'text', text: PERSONA + standing, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: studentBlock },
        ],
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 2 }],
        messages: turns,
      });

    let response = await ask();
    // A server-side web search can pause the turn; resend the conversation
    // with the paused assistant content and the API resumes where it left
    // off. Bounded, so a stuck search cannot spin the route forever.
    for (let i = 0; i < 2 && response.stop_reason === 'pause_turn'; i++) {
      turns.push({ role: 'assistant', content: response.content });
      response = await ask();
    }

    if (response.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'refused', quota }, { status: 200 });
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (!text) return NextResponse.json({ error: 'server_error' }, { status: 500 });

    // Persist both sides, bump the thread, charge the quota. Charged only
    // after a delivered answer: a failed request must not cost a question.
    await admin.from('chat_messages').insert([
      { thread_id: threadId, user_id: userId, role: 'user', content: message },
      { thread_id: threadId, user_id: userId, role: 'assistant', content: text },
    ]);
    await admin.from('chat_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId);
    await admin.from('ai_usage').upsert(
      { user_id: userId, day: dayKey(), used: quota.used + 1 },
      { onConflict: 'user_id,day' },
    );

    return NextResponse.json({
      threadId,
      text,
      quota: { ...quota, used: quota.used + 1, remaining: quota.remaining - 1 },
    });
  } catch (e) {
    console.error('[tutor]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'server_error', quota }, { status: 502 });
  }
}
