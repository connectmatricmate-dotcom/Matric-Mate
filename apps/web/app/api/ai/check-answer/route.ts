import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { BOARD_WITH_ARTICLE, subjectMedium } from '@matricmate/core';
import { AI_COST, AI_MODEL, chargeQuota, guardAi, outsideTrial, refused, studentMedium } from '@/lib/ai/guard';
import { languageRule } from '@/lib/ai/language';

/**
 * The answer checker: a student writes their own answer to a short question
 * and gets it marked the way the board would mark it, against the question's
 * real marking points from our bank. This is the practice tuition centres
 * charge for: not "what is the answer" but "what would MY answer have
 * scored, and where did the marks go".
 */
export const maxDuration = 120;

const anthropic = new Anthropic();

const VERDICT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    score: { type: 'integer', enum: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
    feedback: { type: 'string' },
    missed: { type: 'array', items: { type: 'string' } },
  },
  required: ['score', 'feedback', 'missed'],
  additionalProperties: false,
};

export async function POST(req: NextRequest) {
  const g = await guardAi(req, AI_COST.check);
  if (g instanceof NextResponse) return g;

  let body: {
    question?: string;
    modelAnswer?: string;
    points?: string[];
    marks?: number;
    answer?: string;
    medium?: string;
    /** The question's chapter, or failing that its subject. Optional, and
     *  only used to find the subject's own language. */
    chapterId?: string;
    subjectId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const question = (body.question ?? '').trim().slice(0, 1500);
  const modelAnswer = (body.modelAnswer ?? '').trim().slice(0, 3000);
  const answer = (body.answer ?? '').trim().slice(0, 3000);
  const marks = Math.min(8, Math.max(1, Number(body.marks) || 3));
  const points = Array.isArray(body.points) ? body.points.slice(0, 8).map((p) => String(p).slice(0, 300)) : [];
  /*
   * Feedback in the subject's own language. An Urdu-medium student's answer
   * to an English grammar question was marked in Urdu, and an English-medium
   * student's Urdu essay in English. Without a chapter or subject in the
   * request this falls back to the student's medium, as it always did.
   */
  const from = String(body.chapterId || body.subjectId || '').slice(0, 40);
  const medium = from ? subjectMedium(from, g.board, studentMedium(body.medium, g)) : studentMedium(body.medium, g);
  if (!question || !answer || !modelAnswer) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  // A free trial checks answers from its own subject only, like every other
  // AI route (outsideTrial). A chapter id starts with its subject's id.
  if (from) {
    const shut = outsideTrial(g, from.split('-')[0]);
    if (shut) return shut;
  }

  try {
    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 1500,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: VERDICT_SCHEMA } },
      system:
        `You are ${BOARD_WITH_ARTICLE[g.board]} Class ${g.grade} (SSC-${g.grade === 10 ? 'II' : 'I'}) examiner marking a short answer. Award marks strictly by the marking points: each point earned is stated or clearly implied in the student answer. Partial credit is normal. Never award more than the maximum marks. feedback is 2 to 4 encouraging but honest sentences telling the student exactly what earned marks and what to add next time. missed lists the marking points they did not earn, empty when full marks. Plain text only: no markdown headings, no asterisks or bold markers, no tables, no code fences. Never use an em dash; use a comma, a colon, or a new sentence. ` +
        languageRule(medium, g.grade, g.board),
      messages: [
        {
          role: 'user',
          content: `Question (${marks} marks): ${question}\n\nModel answer: ${modelAnswer}\n\nMarking points:\n${points.map((p, i) => `${i + 1}. ${p}`).join('\n') || '(none listed; mark against the model answer)'}\n\nStudent's answer:\n${answer}`,
        },
      ],
    });
    if (response.stop_reason === 'refusal') return refused(g.quota);
    const block = response.content.find((b) => b.type === 'text');
    if (!block) return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 502 });
    const verdict = JSON.parse(block.text) as { score: number; feedback: string; missed: string[] };
    verdict.score = Math.min(marks, Math.max(0, verdict.score));
    // Full marks with a point listed as missed, which the model sometimes
    // returns for a nitpick, printed "Marks you missed" under "2 of 2 marks".
    // The nitpick is already in the feedback.
    if (verdict.score >= marks) verdict.missed = [];

    const quota = await chargeQuota(g, AI_COST.check);
    return NextResponse.json({ ...verdict, maxMarks: marks, quota });
  } catch (e) {
    console.error('[check-answer]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 502 });
  }
}
