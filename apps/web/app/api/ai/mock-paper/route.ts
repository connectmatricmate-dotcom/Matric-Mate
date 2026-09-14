import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { BOARD_WITH_ARTICLE, subjectMedium, translate } from '@matricmate/core';
import {
  AI_COST,
  AI_MODEL,
  type Grounding,
  chapterGrounding,
  chargeQuota,
  groundingBrief,
  guardAi,
  outsideTrial,
  refused,
  studentMedium,
} from '@/lib/ai/guard';
import { languageRule } from '@/lib/ai/language';
import type { createAdminClient } from '@/lib/supabase/admin';

/**
 * The mock paper generator: one tap builds a board-pattern paper for a
 * subject. The chapter mix follows the board's own weightage from our
 * chapters table, which is the thing tuition centres sell as "guess papers".
 *
 * Hybrid on purpose. Section A (MCQs) and Section B (short questions) are
 * DRAWN from the human-reviewed bank, weighted by exam share: real vetted
 * questions, zero model cost. Section C (long questions) is WRITTEN by the
 * model, one question per chapter, from chapters picked by the same weights,
 * because the bank stores short answers and a board paper needs full
 * 5-to-8-mark questions with marking points.
 */
/*
 * Urdu costs roughly 1.6x the wall clock of English for the same content:
 * Arabic script tokenises far worse, so the model has to emit many more tokens
 * to say the same thing. Measured, not guessed: 5 MCQs took 13.6s in English
 * and 21.2s in Urdu. At 60s a mock paper that finished in English returned a
 * 504 in Urdu, which is what the client hit.
 *
 * 300 is Vercel's ceiling on the paid plans. If this project is on Hobby the
 * build refuses it, in which case the previous deployment keeps serving and
 * this comes back to 60.
 */
export const maxDuration = 300;

const anthropic = new Anthropic();

const MCQ_COUNT = 12;
const SHORT_COUNT = 8;
const LONG_COUNT = 3;
const PAGE = 1000;

const LONG_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          q: { type: 'string' },
          answer: { type: 'string' },
          points: { type: 'array', items: { type: 'string' } },
          marks: { type: 'integer', enum: [5, 6, 7, 8] },
        },
        required: ['q', 'answer', 'points', 'marks'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

type Chapter = { id: string; title: string; share: number | null };
type McqRow = { id: string; chapter_id: string; topic: string; q: string; options: string[]; answer: number; explanation: string; difficulty: string };
type ShortRow = { id: string; chapter_id: string; marks: number; q: string; answer: string; points: string[] };
type LongQ = { q: string; answer: string; points: string[]; marks: number; chapterId: string };

/** Deterministic-enough shuffle; the draw varies per request, which is the point. */
function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * How much of the paper each chapter should carry, in percent.
 *
 * The board's own share where the chapter has one. A share of 0 is the board
 * saying the chapter is not examined (Chemistry 9's practical chapters), so it
 * carries nothing. A chapter with no share at all gets an even cut of whatever
 * the known shares leave over, which reads the data the way it was entered:
 *  - no shares anywhere (all of Punjab, FBISE Maths 9, Islamiyat): everything
 *    is left over, so every chapter weighs the same;
 *  - shares that already make 100 (English 9, Urdu 9): nothing is left over,
 *    and the chapters without one are the oral and listening units, which the
 *    written paper does not test;
 *  - shares that fall short (Pakistan Studies 9: one chapter at 22%): the
 *    other 78% is spread across the rest.
 *
 * The old rule gave a chapter without a share the whole subject's total, so
 * the one Pakistan Studies chapter with a share took the entire paper.
 *
 * A subject with no shares at all cannot tell an unexamined chapter from the
 * rest, so it only leaves one out once its share is set to 0. FBISE Maths 9
 * chapters 1, 10 and 13 and English 10 chapter 1 say in their own blurbs that
 * the paper does not test them, and still carry no share.
 */
function weights(chapters: Chapter[]): Map<string, number> {
  const known = chapters.filter((c) => c.share !== null);
  const unknown = chapters.length - known.length;
  const leftover = Math.max(0, 100 - known.reduce((s, c) => s + (c.share ?? 0), 0));
  // Under one percent left is rounding in the entered shares, not a chapter.
  const each = unknown && leftover >= 1 ? leftover / unknown : 0;
  const out = new Map(chapters.map((c) => [c.id, c.share ?? each]));
  // Nothing examinable at all would be a data mistake. Weigh them evenly
  // rather than refuse the paper.
  if (![...out.values()].some((w) => w > 0)) for (const c of chapters) out.set(c.id, 1);
  return out;
}

/**
 * Split `total` across chapters in proportion to their weight, largest
 * remainders first, so the paper leans where the board says marks live.
 * Ties are broken at random: with even weights and more chapters than
 * questions, a stable sort handed every question to the first chapters.
 */
function allocate(ids: string[], weight: Map<string, number>, total: number): Map<string, number> {
  const sum = ids.reduce((s, id) => s + (weight.get(id) ?? 0), 0);
  if (!ids.length || sum <= 0) return new Map();
  const exact = shuffle(ids).map((id) => ({ id, x: (total * (weight.get(id) ?? 0)) / sum }));
  const out = new Map(exact.map((e) => [e.id, Math.floor(e.x)]));
  let left = total - [...out.values()].reduce((s, n) => s + n, 0);
  for (const e of exact.sort((a, b) => b.x - Math.floor(b.x) - (a.x - Math.floor(a.x)))) {
    if (left <= 0) break;
    out.set(e.id, (out.get(e.id) ?? 0) + 1);
    left--;
  }
  return out;
}

/** Up to `n` different chapters, each drawn with probability in proportion to its weight. */
function pickWeighted(ids: string[], weight: Map<string, number>, n: number): string[] {
  const pool = ids.filter((id) => (weight.get(id) ?? 0) > 0);
  const out: string[] = [];
  while (out.length < n && pool.length) {
    let r = Math.random() * pool.reduce((s, id) => s + (weight.get(id) ?? 0), 0);
    let i = 0;
    for (; i < pool.length - 1; i++) {
      r -= weight.get(pool[i]) ?? 0;
      if (r < 0) break;
    }
    out.push(pool[i]);
    pool.splice(i, 1);
  }
  return out;
}

/** Every published bank row for these chapters, paged: select() stops at a thousand. */
async function bankRows<Row>(
  admin: ReturnType<typeof createAdminClient>,
  table: 'mcqs' | 'short_questions',
  columns: string,
  chapterIds: string[],
  medium: string,
): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from(table)
      .select(columns)
      .in('chapter_id', chapterIds)
      .eq('medium', medium)
      .eq('review_status', 'published')
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table} read failed: ${error.message}`);
    const rows = (data ?? []) as unknown as Row[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

export async function POST(req: NextRequest) {
  const g = await guardAi(req, AI_COST.paper);
  if (g instanceof NextResponse) return g;

  let body: { subjectId?: string; medium?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const subjectId = (body.subjectId ?? '').slice(0, 40);
  if (!subjectId) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const shut = outsideTrial(g, subjectId);
  if (shut) return shut;
  const readsIn = studentMedium(body.medium, g);
  // The subject's own language: an Urdu paper is written in Urdu and an
  // English one in English, whichever medium the student reads in.
  const medium = subjectMedium(subjectId, g.board, readsIn);

  const [{ data: subject, error: subjectError }, { data: chapterRows, error: chaptersError }] = await Promise.all([
    g.admin.from('subjects').select('id,name,urdu_name').eq('id', subjectId).maybeSingle(),
    g.admin
      .from('chapters')
      .select('id,title,exam_share')
      .eq('subject_id', subjectId)
      .eq('grade', g.grade)
      // The admin client skips RLS, so the board wall is this line.
      .eq('board', g.board)
      .eq('review_status', 'published')
      .order('number'),
  ]);
  if (subjectError || chaptersError) return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 503 });
  if (!subject || !chapterRows?.length) return NextResponse.json({ error: 'no_content', quota: g.quota }, { status: 404 });
  const chapters: Chapter[] = chapterRows.map((c) => ({
    id: c.id as string,
    title: c.title as string,
    share: c.exam_share === null || c.exam_share === undefined ? null : Number(c.exam_share) || 0,
  }));
  const weight = weights(chapters);

  // Sections A and B: draw from the bank, weighted by the board's shares.
  const chapterIds = chapters.map((c) => c.id);
  let mcqRows: McqRow[];
  let shortRows: ShortRow[];
  let withNotes: Set<string>;
  try {
    const [mcq, short, sections] = await Promise.all([
      bankRows<McqRow>(g.admin, 'mcqs', 'id,chapter_id,topic,q,options,answer,explanation,difficulty', chapterIds, medium),
      bankRows<ShortRow>(g.admin, 'short_questions', 'id,chapter_id,marks,q,answer,points', chapterIds, medium),
      // Which chapters have published notes, so Section C is written from our
      // own text wherever there is some.
      g.admin
        .from('chapter_sections')
        .select('chapter_id')
        .in('chapter_id', chapterIds)
        .eq('medium', medium)
        .eq('review_status', 'published')
        .order('id')
        .range(0, PAGE - 1),
    ]);
    if (sections.error) throw new Error(`sections read failed: ${sections.error.message}`);
    mcqRows = mcq;
    shortRows = short;
    withNotes = new Set(((sections.data ?? []) as { chapter_id: string }[]).map((r) => r.chapter_id));
  } catch (e) {
    console.error('[mock-paper]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 503 });
  }

  const draw = <T extends { id: string; chapter_id: string }>(rows: T[], total: number): T[] => {
    const byChapter = new Map<string, T[]>();
    for (const r of shuffle(rows)) {
      const list = byChapter.get(r.chapter_id) ?? [];
      list.push(r);
      byChapter.set(r.chapter_id, list);
    }
    const plan = allocate(chapterIds.filter((id) => byChapter.has(id)), weight, total);
    const picked: T[] = [];
    for (const [chapterId, n] of plan) picked.push(...(byChapter.get(chapterId) ?? []).slice(0, n));
    // Thin chapters can undershoot their allocation; top up from the rest,
    // examined chapters first.
    if (picked.length < total) {
      const seen = new Set(picked.map((p) => p.id));
      const examined = (r: T) => ((weight.get(r.chapter_id) ?? 0) > 0 ? 1 : 0);
      for (const r of shuffle(rows).sort((a, b) => examined(b) - examined(a))) {
        if (picked.length >= total) break;
        if (!seen.has(r.id)) picked.push(r);
      }
    }
    return shuffle(picked.slice(0, total));
  };

  const mcqs = draw(mcqRows, MCQ_COUNT);
  const shortQs = draw(shortRows, SHORT_COUNT);
  if (mcqs.length < 5 || shortQs.length < 4) return NextResponse.json({ error: 'no_content', quota: g.quota }, { status: 404 });

  /*
   * Section C: which chapters the long questions come from.
   *
   * One question per chapter, each chapter drawn by its weight, so a paper
   * leans where the marks are without being the same three chapters every
   * time. Chapters with our own published notes are preferred, because a long
   * question written from the student's own text beats one written from the
   * model's memory of the syllabus. This used to take the two "heaviest"
   * chapters by a stable sort, and where a subject had no shares that was
   * simply chapters 1 and 2: Matrices for FBISE Maths 9, which the board does
   * not examine, and Oral Communication for English 10.
   */
  const inBank = new Set([...mcqRows, ...shortRows].map((r) => r.chapter_id));
  const longChapters: string[] = [];
  // Notes first, then chapters that at least have bank questions, then
  // anything examined: each tier only fills what the one before left empty.
  for (const tier of [(id: string) => withNotes.has(id), (id: string) => inBank.has(id), () => true]) {
    const pool = chapterIds.filter((id) => tier(id) && !longChapters.includes(id));
    longChapters.push(...pickWeighted(pool, weight, LONG_COUNT - longChapters.length));
    if (longChapters.length >= LONG_COUNT) break;
  }
  if (!longChapters.length) return NextResponse.json({ error: 'no_content', quota: g.quota }, { status: 404 });

  /*
   * Topics already known for each chapter, from the MCQ bank we just read.
   * Free: no extra query, and they are the board's own topic labels.
   */
  const topicsByChapter = new Map<string, string[]>();
  for (const row of shuffle(mcqRows)) {
    if (!row.topic) continue;
    const list = topicsByChapter.get(row.chapter_id) ?? [];
    if (!list.includes(row.topic)) list.push(row.topic);
    topicsByChapter.set(row.chapter_id, list);
  }

  /**
   * One request per question, all at once.
   *
   * This was a single call writing all three long questions in sequence, and
   * in Urdu it stopped fitting in the function budget: Arabic script costs
   * roughly 1.6x the wall clock of Latin for the same content (measured),
   * which pushed a paper that finished in English straight past the limit and
   * returned a 504 to the student. In parallel the wall clock is one question
   * rather than three in a row.
   *
   * A subject with fewer than three chapters to draw from repeats them, and
   * each repeat is handed a different topic from that chapter so two questions
   * running at once, blind to each other, do not land on the same idea.
   * Advisory rather than binding: a chapter with fewer topics than questions
   * still gets whole questions, just unsteered ones.
   */
  const usedTopics = new Map<string, number>();
  const parts = Array.from({ length: LONG_COUNT }, (_, i) => {
    const chapterId = longChapters[i % longChapters.length];
    const pool = topicsByChapter.get(chapterId) ?? [];
    const n = usedTopics.get(chapterId) ?? 0;
    usedTopics.set(chapterId, n + 1);
    return { chapterId, topic: pool.length ? pool[n % pool.length] : null };
  });

  let groundings: Map<string, Grounding>;
  try {
    const found = await Promise.all(
      [...new Set(parts.map((p) => p.chapterId))].map(async (id) => [id, await chapterGrounding(g.admin, id, medium, 9000, g.grade, g.board)] as const),
    );
    groundings = new Map(found.filter((f): f is readonly [string, Grounding] => !!f[1]));
  } catch (e) {
    console.error('[mock-paper]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 503 });
  }

  /*
   * allSettled, not all. One overloaded or unparseable answer used to fail the
   * whole paper after the other calls had already been paid for on the
   * client's key. Sections A and B are real board questions and stand on their
   * own, so the paper ships with whatever Section C came back.
   */
  const settled = await Promise.allSettled(
    parts.map(async (part): Promise<LongQ[] | 'refused'> => {
      const grounding = groundings.get(part.chapterId);
      if (!grounding) return [];
      const response = await anthropic.messages.create({
        model: AI_MODEL,
        // One question, with headroom for Urdu, which needs far more tokens
        // to say the same thing.
        max_tokens: 2600,
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: LONG_SCHEMA } },
        system:
          `You write Section C long questions for ${BOARD_WITH_ARTICLE[g.board]} Class ${g.grade} (SSC-${g.grade === 10 ? 'II' : 'I'}) board paper. ${grounding.grounded ? 'Work ONLY from the chapter text provided.' : 'Follow the chapter brief provided.'} Each question demands an extended answer: derivations, multi-part numericals, explain-with-examples. Give a thorough model answer and 4 to 6 marking points showing where each mark is earned. ` +
          languageRule(medium, g.grade, g.board),
        messages: [
          {
            role: 'user',
            content:
              `${groundingBrief(grounding, g.grade, g.board)}\n\n---\n` +
              'Write exactly 1 long question in board style.' +
              (part.topic
                ? ` Build it around "${part.topic}". Other questions on this paper cover the chapter's other topics, so do not stray onto them.`
                : ''),
          },
        ],
      });
      if (response.stop_reason === 'refusal') return 'refused';
      const block = response.content.find((b) => b.type === 'text');
      if (!block) return [];
      const parsed = JSON.parse(block.text) as { items: Omit<LongQ, 'chapterId'>[] };
      return (parsed.items ?? []).map((item) => ({ ...item, chapterId: part.chapterId }));
    }),
  );

  const longQs: LongQ[] = [];
  let refusals = 0;
  for (const s of settled) {
    if (s.status === 'rejected') console.error('[mock-paper] long question failed', s.reason instanceof Error ? s.reason.message : s.reason);
    else if (s.value === 'refused') refusals++;
    else longQs.push(...s.value);
  }
  if (!longQs.length) {
    return refusals ? refused(g.quota) : NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 502 });
  }

  const items = {
    mcqs: mcqs.map((m) => ({
      id: m.id,
      chapterId: m.chapter_id,
      topic: m.topic,
      q: m.q,
      options: m.options,
      answer: m.answer,
      explanation: m.explanation,
      difficulty: m.difficulty,
    })),
    shortQs: shortQs.map((s) => ({ id: s.id, chapterId: s.chapter_id, marks: s.marks, q: s.q, answer: s.answer, points: s.points })),
    longQs: longQs.map((l, i) => ({ id: `lq-${i + 1}`, ...l })),
  };

  // In the language the student reads the app in, like the rest of the header
  // it sits in. It is stored, so it keeps the language it was made in.
  const title =
    readsIn === 'ur'
      ? `${(subject.urdu_name as string | null) || (subject.name as string)} · ${translate('ur', 'tutor.paperTitle')}`
      : `${subject.name as string} mock paper`;

  const { data: saved, error } = await g.admin
    .from('ai_sessions')
    .insert({
      user_id: g.userId,
      kind: 'paper',
      title,
      subject_id: subjectId,
      medium,
      items,
    })
    .select('id')
    .single();
  if (error || !saved) {
    console.error('[mock-paper] save failed', error?.message);
    return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 500 });
  }

  const quota = await chargeQuota(g, AI_COST.paper);
  return NextResponse.json({ sessionId: saved.id, items, quota });
}
