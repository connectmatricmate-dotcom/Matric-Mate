import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { BOARD_WITH_ARTICLE, SUBJECTS, asBoard, streakFrom, weakTopics, type Board } from '@matricmate/core';
import type { Attempt } from '@matricmate/core';
import { AI_MODEL } from '@/lib/ai/guard';
import { languageRule } from '@/lib/ai/language';
import { JobError, withRetry } from '@/lib/notify/jobs';
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

/**
 * One client for the job, with a limit on each call: a minute, and one retry.
 * The SDK's default waits ten minutes, so a single stalled answer could hold
 * the whole nightly run, and every student queued behind it, for longer than
 * the run is allowed. A report is 10 to 20 seconds when things are well.
 */
const anthropic = new Anthropic({ timeout: 60_000, maxRetries: 1 });

export type CoachDigest = {
  streak: number;
  xp: number;
  attemptsThisWeek: number;
  accuracyPct: number;
  topics: { topic: string; pct: number; tries: number }[];
  subjects: string[];
  language: string;
  grade: 9 | 10;
  board: Board;
};

type AttemptRow = { chapter_id: string; subject_id: string; topic: string | null; correct: boolean; confidence: number; at: string };

/**
 * The student's own week, read from their rows rather than taken on trust.
 *
 * Null when they have never answered a question. Throws JobError when a read
 * fails even after retrying: a report written from half the rows would tell a
 * student something untrue about their week.
 */
export async function buildDigestFromDb(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<CoachDigest | null> {
  const [attemptsRes, daysRes, profileRes] = await Promise.all([
    withRetry((signal) =>
      admin
        .from('attempts')
        .select('chapter_id,subject_id,topic,correct,confidence,at')
        .eq('user_id', userId)
        .order('at', { ascending: false })
        .order('id')
        .range(0, 999)
        .abortSignal(signal),
    ),
    withRetry((signal) =>
      admin.from('active_days').select('day').eq('user_id', userId).order('day', { ascending: false }).range(0, 399).abortSignal(signal),
    ),
    withRetry((signal) => admin.from('profiles').select('grade,board,onboarding').eq('id', userId).abortSignal(signal).maybeSingle()),
  ]);
  const failed = attemptsRes.error ?? daysRes.error ?? profileRes.error;
  if (failed) throw new JobError('digest', failed.message);

  const all = (attemptsRes.data ?? []) as AttemptRow[];
  if (!all.length) return null;

  /*
   * Topics the AI practice sets saved with no name. Named by their chapter,
   * because "- : 40% over 6 tries" is what the model was given before, and it
   * duly wrote reports saying "the topic name is missing".
   */
  const unnamed = [...new Set(all.filter((r) => !r.topic?.trim()).map((r) => r.chapter_id))];
  const chapterTitle = new Map<string, string>();
  if (unnamed.length) {
    const { data: rows, error } = await withRetry((signal) => admin.from('chapters').select('id,title').in('id', unnamed).abortSignal(signal));
    if (error) throw new JobError('digest', error.message);
    for (const r of (rows ?? []) as { id: string; title: string }[]) chapterTitle.set(r.id, r.title);
  }

  const attempts: Attempt[] = all.map((r, i) => ({
    id: `s-${i}`,
    mcqId: `${r.chapter_id}-${i}`,
    chapterId: r.chapter_id,
    subjectId: r.subject_id,
    topic: r.topic?.trim() || chapterTitle.get(r.chapter_id) || '',
    correct: r.correct,
    confidence: r.confidence as Attempt['confidence'],
    mode: 'practice',
    at: Date.parse(r.at),
  }));

  const weekAgo = Date.now() - 7 * 864e5;
  const recent = attempts.filter((a) => a.at >= weekAgo);
  const correct = recent.filter((a) => a.correct).length;

  const profile = profileRes.data as { grade?: number; board?: string; onboarding?: { subjects?: string[]; medium?: string } | null } | null;
  const onboarding = profile?.onboarding;
  /*
   * The subjects they chose, or failing that the ones they have actually
   * practised. Web sign-ups often have no saved list, and the model was being
   * told "Subjects: unknown" about a student with a week of Physics.
   */
  const subjectIds = onboarding?.subjects?.length ? onboarding.subjects : [...new Set(all.map((r) => r.subject_id).filter(Boolean))];

  return {
    /*
     * The app's own streak rule, from core. The job runs at 06:30 in Karachi,
     * before almost anyone has studied that day, and the old count started
     * from today, found nothing, and stopped: every report told the model the
     * streak was 0, and the model told students they were "getting their
     * streak going again" the morning after a study day. streakFrom lets today
     * still be empty.
     */
    streak: streakFrom(((daysRes.data ?? []) as { day: string }[]).map((d) => d.day)),
    xp: 0,
    attemptsThisWeek: recent.length,
    accuracyPct: recent.length ? Math.round((correct / recent.length) * 100) : 0,
    topics: weakTopics(attempts.filter((a) => a.topic), 2)
      .slice(0, 8)
      .map((w) => ({ topic: w.topic, pct: w.accuracy, tries: w.total })),
    subjects: subjectIds.map((id) => SUBJECTS.find((s) => s.id === id)?.name ?? id),
    language: onboarding?.medium === 'ur' ? 'ur' : 'en',
    grade: profile?.grade === 10 ? 10 : 9,
    board: asBoard(profile?.board),
  };
}

export async function writeCoachReport(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  digest: CoachDigest,
  period: string,
): Promise<boolean> {
  const response = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 1200,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: REPORT_SCHEMA } },
    system:
      `You are a study coach for ${BOARD_WITH_ARTICLE[digest.board]} Class ${digest.grade} (SSC-${digest.grade === 10 ? 'II' : 'I'}) student in Pakistan. From their week of practice data, write: summary (2 warm, specific sentences about the week; if they did little, a kind nudge, never a scolding), weak (their 2 weakest topics with one plain-words sentence each on why it matters for the board paper), actions (exactly 3 short, concrete things to do this week, each doable in one sitting). Plain text only: no markdown headings, no asterisks or bold markers, no tables, no code fences. Never use an em dash; use a comma, a colon, or a new sentence. ` +
      languageRule(digest.language, digest.grade, digest.board),
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
  const body = JSON.parse(block.text);

  // An upsert on (user, day), so writing it twice is harmless and retrying is safe.
  const { error } = await withRetry((signal) =>
    admin.from('coach_reports').upsert({ user_id: userId, period, body }, { onConflict: 'user_id,period' }).abortSignal(signal),
  );
  if (error) console.error('[coach] report write failed', error.message);
  return !error;
}
