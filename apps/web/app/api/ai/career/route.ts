import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { BOARD_WITH_ARTICLE, SUBJECTS, type CareerReport, type CareerState, type CareerSubjectStat } from '@matricmate/core';
import { AI_COST, AI_MODEL, chargeQuota, guardAi, guardStudent, noteAiFailure, refused, type Guarded } from '@/lib/ai/guard';
import { languageRule } from '@/lib/ai/language';

/**
 * Career guidance from a student's results (the client's notes, 14 Sep 2026).
 *
 * The client's words: take the student's results in Maths, Physics, Chemistry,
 * Biology, English and Computer, and tell them which way to go. So this reads
 * every answer they have given, subject by subject, and asks the model to
 * read those numbers the way a careers counsellor would, for a Pakistani
 * student about to choose a Class 11 group.
 *
 * GET is free and never calls the model: the saved guidance and the numbers.
 * POST writes it, once a week at most, and only from enough answers to mean
 * something. It is an AI feature, so it is Premium's (and a trial's, whose one
 * subject will rarely be enough), refused to Basic by the guard.
 */
// The apps wait 90 seconds and retry once; the route must outlive both.
export const maxDuration = 300;

/** Answers a subject needs before it counts, and how many subjects must have them. */
const NEED_PER_SUBJECT = 20;
const NEED_SUBJECTS = 2;
/** How long a reading stands before a new one may be asked for. */
const FRESH_DAYS = 7;

const anthropic = new Anthropic({ timeout: 90_000, maxRetries: 1 });

const REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'strengths', 'streams', 'fields', 'nextSteps'],
  properties: {
    summary: { type: 'string' },
    strengths: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['subject', 'why'], properties: { subject: { type: 'string' }, why: { type: 'string' } } },
    },
    streams: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['name', 'why'], properties: { name: { type: 'string' }, why: { type: 'string' } } },
    },
    fields: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['name', 'why'], properties: { name: { type: 'string' }, why: { type: 'string' } } },
    },
    nextSteps: { type: 'array', items: { type: 'string' } },
  },
} as const;

type Profile = { grade: number | null; board: string | null; onboarding: { subjects?: string[]; group?: string; medium?: string } | null };

/**
 * Every answer the student has given, counted per subject. Paged: select()
 * stops at a thousand rows without saying so, and a student who has been at
 * it for a term is past that.
 */
async function subjectStats(g: Guarded): Promise<CareerSubjectStat[]> {
  const counts = new Map<string, { answered: number; correct: number }>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await g.admin
      .from('attempts')
      .select('subject_id, correct')
      .eq('user_id', g.userId)
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`attempts read failed: ${error.message}`);
    const rows = (data ?? []) as { subject_id: string | null; correct: boolean }[];
    for (const r of rows) {
      if (!r.subject_id) continue;
      const c = counts.get(r.subject_id) ?? { answered: 0, correct: 0 };
      c.answered += 1;
      if (r.correct) c.correct += 1;
      counts.set(r.subject_id, c);
    }
    if (rows.length < PAGE) break;
  }
  return [...counts.entries()]
    .map(([subject, c]) => ({ subject, answered: c.answered, correct: c.correct, accuracy: Math.round((c.correct / c.answered) * 100) }))
    .sort((a, b) => b.answered - a.answered);
}

/** The saved reading, the numbers, and what the screen may do next. */
async function state(g: Guarded): Promise<CareerState> {
  const [stats, { data: saved, error }] = await Promise.all([
    subjectStats(g),
    g.admin.from('career_reports').select('body, created_at').eq('user_id', g.userId).maybeSingle(),
  ]);
  if (error) throw new Error(`career read failed: ${error.message}`);
  const createdAt = (saved?.created_at as string | undefined) ?? null;
  const next = createdAt ? Date.parse(createdAt) + FRESH_DAYS * 864e5 : 0;
  return {
    report: (saved?.body as CareerReport | undefined) ?? null,
    createdAt,
    stats,
    answered: stats.reduce((n, s) => n + s.answered, 0),
    need: NEED_PER_SUBJECT,
    enough: stats.filter((s) => s.answered >= NEED_PER_SUBJECT).length >= NEED_SUBJECTS,
    nextAt: next > Date.now() ? new Date(next).toISOString() : null,
    quota: g.quota,
  };
}

export async function GET(req: NextRequest) {
  // Free: the quota gate is not asked, only who this is and whether AI is in their plan.
  const g = await guardStudent(req);
  if (g instanceof NextResponse) return g;
  try {
    return NextResponse.json(await state(g));
  } catch (err) {
    console.error('[career] read failed', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const g = await guardAi(req, AI_COST.career);
  if (g instanceof NextResponse) return g;

  let body: { language?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  let now: CareerState;
  try {
    now = await state(g);
  } catch (err) {
    console.error('[career] read failed', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 503 });
  }
  // This week's reading stands: the same answers read again say the same thing.
  if (now.report && now.nextAt) return NextResponse.json(now);
  if (!now.enough) return NextResponse.json({ ...now, error: 'not_enough' }, { status: 422 });

  const { data: profile } = await g.admin.from('profiles').select('grade, board, onboarding').eq('id', g.userId).maybeSingle();
  const p = (profile ?? { grade: null, board: null, onboarding: null }) as Profile;
  const language = body.language === 'ur' ? 'ur' : body.language === 'en' ? 'en' : p.onboarding?.medium === 'ur' ? 'ur' : 'en';
  const name = (id: string) => SUBJECTS.find((s) => s.id === id)?.name ?? id;
  const group = p.onboarding?.group === 'arts' ? 'Humanities (Arts)' : p.onboarding?.group === 'science' ? 'Science' : 'not saved';
  const taking = (p.onboarding?.subjects ?? []).map(name).join(', ') || 'not saved';

  const lines = now.stats.map(
    (s) => `- ${name(s.subject)}: ${s.accuracy}% right over ${s.answered} answers${s.answered < NEED_PER_SUBJECT ? ' (few answers, weigh lightly)' : ''}`,
  );

  let report: CareerReport;
  try {
    const response = await anthropic.messages.create({
      model: AI_MODEL,
      // Five parts in Urdu run long; 1,800 cut some of them off.
      max_tokens: 4000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: REPORT_SCHEMA } },
      system:
        `You are a careers counsellor for ${BOARD_WITH_ARTICLE[g.board]} Class ${g.grade} student in Pakistan who will choose a Class 11 group after the matric exams. ` +
        'You are given their practice results in MatricMate, subject by subject. Read the numbers honestly: where they are strong, what that suits, and what would open more doors. ' +
        'Write: summary (2 or 3 warm, specific sentences that name their strongest subjects with the numbers), ' +
        'strengths (their 2 or 3 strongest subjects, one sentence each on what the number shows), ' +
        'streams (2 or 3 Class 11 groups that suit them, from: FSc Pre-Medical, FSc Pre-Engineering, ICS (Computer Science), I.Com (Commerce), FA (Humanities), and DAE (a technical diploma) where it fits; each with one or two sentences on why, tied to their numbers), ' +
        'fields (3 to 5 fields of study or work that suit those results, such as medicine, engineering, computer science, accounting and business, law, teaching or design; each with one sentence on why), ' +
        'nextSteps (exactly 3 short, concrete things to do in the next month, like which subject to raise and by how much). ' +
        'A subject with few answers says little: weigh it lightly and do not build advice on it. A low score is something to work on, never a closed door. ' +
        'Do not invent admission merit, fees or statistics; this is guidance, not a verdict. ' +
        'Plain text only: no markdown, no asterisks or bold, no emojis. Never use an em dash; use a comma, a colon, or a new sentence. ' +
        languageRule(language, g.grade, g.board),
      messages: [
        {
          role: 'user',
          content: `Their group now: ${group}. Subjects they take: ${taking}.\n\nPractice results, most practised first:\n${lines.join('\n')}`,
        },
      ],
    });
    if (response.stop_reason === 'refusal') return refused(g.quota);
    // Cut off at the limit, the JSON is not whole: an error, not a report.
    if (response.stop_reason === 'max_tokens') throw new Error('report cut off at the token limit');
    const block = response.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') return refused(g.quota);
    report = JSON.parse(block.text) as CareerReport;
  } catch (err) {
    console.error('[career] model call failed', err instanceof Error ? err.message : err);
    await noteAiFailure(err);
    return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 503 });
  }

  const createdAt = new Date().toISOString();
  const { error: writeError } = await g.admin
    .from('career_reports')
    .upsert({ user_id: g.userId, body: report, created_at: createdAt }, { onConflict: 'user_id' });
  if (writeError) console.error('[career] save failed', writeError.message);

  // Charged after delivery, like every AI route: a failed call costs nothing.
  const quota = await chargeQuota(g, AI_COST.career);
  return NextResponse.json({
    ...now,
    report,
    createdAt,
    nextAt: new Date(Date.parse(createdAt) + FRESH_DAYS * 864e5).toISOString(),
    quota,
  } satisfies CareerState);
}
