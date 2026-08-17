import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { weakTopics } from '@matricmate/core';
import type { Attempt } from '@matricmate/core';
import { AI_MODEL } from '@/lib/ai/guard';
import { languageRule } from '@/lib/ai/language';
import type { createAdminClient } from '@/lib/supabase/admin';

/**
 * Writing a student's coach report, from the server's own copy of their week.
 *
 * The digest used to be assembled on the phone and posted up, which meant the
 * report described whatever the client said had happened. It is built here now
 * from the attempts table, so it describes what actually happened, and so the
 * nightly job can write reports for students who are not looking at the app.
 */

const REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'weak', 'actions'],
  properties: {
    summary: { type: 'string' },
    weak: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['topic', 'why'],
        properties: { topic: { type: 'string' }, why: { type: 'string' } },
      },
    },
    actions: { type: 'array', items: { type: 'string' } },
  },
} as const;

export type CoachDigest = {
  streak: number;
  xp: number;
  attemptsThisWeek: number;
  accuracyPct: number;
  topics: { topic: string; pct: number; tries: number }[];
  subjects: string[];
  language: string;
  grade: number;
};

type AttemptRow = { chapter_id: string; subject_id: string; topic: string; correct: boolean; confidence: number; at: string };

/** The student's own week, read from their rows rather than taken on trust. */
export async function buildDigestFromDb(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<CoachDigest | null> {
  const [{ data: rows }, { data: days }, { data: profile }] = await Promise.all([
    admin
      .from('attempts')
      .select('chapter_id,subject_id,topic,correct,confidence,at')
      .eq('user_id', userId)
      .order('at', { ascending: false })
      .limit(1000),
    admin.from('active_days').select('day').eq('user_id', userId).order('day', { ascending: false }).limit(400),
    admin.from('profiles').select('grade,onboarding').eq('id', userId).maybeSingle(),
  ]);

  const all = (rows ?? []) as AttemptRow[];
  if (!all.length) return null;

  const attempts: Attempt[] = all.map((r, i) => ({
    id: `s-${i}`,
    mcqId: `${r.chapter_id}-${i}`,
    chapterId: r.chapter_id,
    subjectId: r.subject_id,
    topic: r.topic,
    correct: r.correct,
    confidence: r.confidence as Attempt['confidence'],
    mode: 'practice',
    at: Date.parse(r.at),
  }));

  const weekAgo = Date.now() - 7 * 864e5;
  const recent = attempts.filter((a) => a.at >= weekAgo);
  const correct = recent.filter((a) => a.correct).length;

  const onboarding = (profile as { onboarding?: { subjects?: string[]; medium?: string } | null } | null)?.onboarding;

  return {
    streak: streakFromDays(((days ?? []) as { day: string }[]).map((d) => d.day)),
    xp: 0,
    attemptsThisWeek: recent.length,
    accuracyPct: recent.length ? Math.round((correct / recent.length) * 100) : 0,
    topics: weakTopics(attempts, 2)
      .slice(0, 8)
      .map((w) => ({ topic: w.topic, pct: w.accuracy, tries: w.total })),
    subjects: onboarding?.subjects ?? [],
    language: onboarding?.medium === 'ur' ? 'ur' : 'en',
    grade: (profile as { grade?: number } | null)?.grade === 10 ? 10 : 9,
  };
}

/** Consecutive days up to today, counted the way the apps count them. */
function streakFromDays(days: string[]): number {
  const set = new Set(days);
  let n = 0;
  const d = new Date();
  for (;;) {
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(d);
    if (!set.has(key)) break;
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export async function writeCoachReport(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  digest: CoachDigest,
  period: string,
): Promise<boolean> {
  const anthropic = new Anthropic();
  const response = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 1200,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: REPORT_SCHEMA } },
    system:
      `You are a study coach for an FBISE Class ${digest.grade} (SSC-${digest.grade === 10 ? 'II' : 'I'}) student in Pakistan. From their week of practice data, write: summary (2 warm, specific sentences about the week; if they did little, a kind nudge, never a scolding), weak (their 2 weakest topics with one plain-words sentence each on why it matters for the board paper), actions (exactly 3 short, concrete things to do this week, each doable in one sitting). Plain text only: no markdown headings, no asterisks or bold markers, no tables, no code fences. Never use an em dash; use a comma, a colon, or a new sentence. ` +
      languageRule(digest.language),
    messages: [
      {
        role: 'user',
        content: `This week: ${digest.attemptsThisWeek} questions attempted, ${digest.accuracyPct}% correct overall, streak ${digest.streak} days. Subjects: ${digest.subjects.join(', ') || 'unknown'}.\n\nAccuracy by topic (worst first):\n${digest.topics.map((t) => `- ${t.topic}: ${t.pct}% over ${t.tries} tries`).join('\n') || '(no topic data yet)'}`,
      },
    ],
  });

  if (response.stop_reason === 'refusal') return false;
  const block = response.content.find((b) => b.type === 'text');
  if (!block) return false;

  const { error } = await admin
    .from('coach_reports')
    .upsert({ user_id: userId, period, body: JSON.parse(block.text) }, { onConflict: 'user_id,period' });
  return !error;
}
