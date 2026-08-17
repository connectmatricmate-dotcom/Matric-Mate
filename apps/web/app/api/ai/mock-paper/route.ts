import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { AI_COST, AI_MODEL, type Grounding, chapterGrounding, chargeQuota, groundingBrief, guardAi } from '@/lib/ai/guard';
import { languageRule } from '@/lib/ai/language';

/**
 * The mock paper generator: one tap builds a board-pattern paper for a
 * subject. The chapter mix follows the board's own weightage from our
 * chapters table, which is the thing tuition centres sell as "guess papers".
 *
 * Hybrid on purpose. Section A (MCQs) and Section B (short questions) are
 * DRAWN from the human-reviewed bank, weighted by exam share: real vetted
 * questions, zero model cost. Section C (long questions) is WRITTEN by the
 * model, grounded on the two heaviest chapters, because the bank stores
 * short answers and a board paper needs full 5-to-8-mark questions with
 * marking points. One model call per paper.
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
 * Split `total` across chapters proportionally to their exam share, largest
 * remainders first, so the paper leans where the board says marks live.
 */
function allocate(chapters: { id: string; share: number }[], total: number): Map<string, number> {
  const sum = chapters.reduce((s, c) => s + c.share, 0) || chapters.length;
  const exact = chapters.map((c) => ({ id: c.id, x: (total * (c.share || sum / chapters.length)) / sum }));
  const out = new Map(exact.map((e) => [e.id, Math.floor(e.x)]));
  let left = total - [...out.values()].reduce((s, n) => s + n, 0);
  for (const e of exact.sort((a, b) => (b.x - Math.floor(b.x)) - (a.x - Math.floor(a.x)))) {
    if (left <= 0) break;
    out.set(e.id, (out.get(e.id) ?? 0) + 1);
    left--;
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
  const medium = body.medium === 'ur' ? 'ur' : 'en';
  if (!subjectId) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const { data: subject } = await g.admin.from('subjects').select('id,name').eq('id', subjectId).maybeSingle();
  const { data: chapterRows } = await g.admin
    .from('chapters')
    .select('id,title,exam_share')
    .eq('subject_id', subjectId)
    .eq('grade', g.grade)
    .eq('review_status', 'published')
    .order('number');
  if (!subject || !chapterRows?.length) return NextResponse.json({ error: 'no_content' }, { status: 404 });
  const chapters = chapterRows.map((c) => ({ id: c.id as string, title: c.title as string, share: Number(c.exam_share) || 0 }));

  // Sections A and B: draw from the bank, weighted by the board's shares.
  const chapterIds = chapters.map((c) => c.id);
  const [{ data: mcqRows }, { data: shortRows }] = await Promise.all([
    g.admin
      .from('mcqs')
      .select('id,chapter_id,topic,q,options,answer,explanation,difficulty')
      .in('chapter_id', chapterIds)
      .eq('medium', medium)
      .eq('review_status', 'published'),
    g.admin
      .from('short_questions')
      .select('id,chapter_id,marks,q,answer,points')
      .in('chapter_id', chapterIds)
      .eq('medium', medium)
      .eq('review_status', 'published'),
  ]);

  const draw = <T extends { chapter_id: string }>(rows: T[], total: number): T[] => {
    const byChapter = new Map<string, T[]>();
    for (const r of shuffle(rows)) {
      const list = byChapter.get(r.chapter_id) ?? [];
      list.push(r);
      byChapter.set(r.chapter_id, list);
    }
    const plan = allocate(chapters.filter((c) => byChapter.has(c.id)), total);
    const picked: T[] = [];
    for (const [chapterId, n] of plan) picked.push(...(byChapter.get(chapterId) ?? []).slice(0, n));
    // Thin chapters can undershoot their allocation; top up from anywhere.
    if (picked.length < total) {
      const seen = new Set(picked.map((p) => (p as { id?: string }).id));
      for (const r of shuffle(rows)) {
        if (picked.length >= total) break;
        if (!seen.has((r as { id?: string }).id)) picked.push(r);
      }
    }
    return shuffle(picked.slice(0, total));
  };

  const mcqs = draw((mcqRows as { id: string; chapter_id: string; topic: string; q: string; options: string[]; answer: number; explanation: string; difficulty: string }[]) ?? [], MCQ_COUNT);
  const shortQs = draw((shortRows as { id: string; chapter_id: string; marks: number; q: string; answer: string; points: string[] }[]) ?? [], SHORT_COUNT);
  if (mcqs.length < 5 || shortQs.length < 4) return NextResponse.json({ error: 'no_content' }, { status: 404 });

  // Section C: the model writes long questions from the two heaviest chapters.
  const heavy = [...chapters].sort((a, b) => b.share - a.share).slice(0, 2);
  const groundings = (
    await Promise.all(heavy.map((c) => chapterGrounding(g.admin, c.id, medium, 9000, g.grade)))
  ).filter(Boolean) as Grounding[];

  /**
   * Section C, one request per chapter, in parallel.
   *
   * This was a single call holding both chapters' text and writing all three
   * long questions in sequence, and in Urdu it stopped fitting in the function
   * budget: Arabic script costs roughly 1.6x the wall clock of Latin for the
   * same content (measured), which pushed a paper that finished in English
   * straight past the limit and returned a 504 to the student.
   *
   * One question per request now, all three at once, so the wall clock is a
   * single question rather than three in a row. Splitting only by chapter was
   * not enough: the chapter holding two questions still took 59s in Urdu,
   * which passes and then fails the first time the model is a little slower.
   *
   * The grounding goes out once per question instead of once per chapter, so
   * this trades some input tokens for latency. Worth it: a student waiting a
   * minute for a paper assumes it is broken.
   */
  /*
   * Topics already known for each chapter, from the MCQ bank we just read.
   * Free: no extra query, and they are the board's own topic labels.
   */
  const topicsByChapter = new Map<string, string[]>();
  for (const row of (mcqRows as { chapter_id: string; topic: string }[]) ?? []) {
    if (!row.topic) continue;
    const list = topicsByChapter.get(row.chapter_id) ?? [];
    if (!list.includes(row.topic)) list.push(row.topic);
    topicsByChapter.set(row.chapter_id, list);
  }

  let taken = 0;
  const split = Array.from({ length: LONG_COUNT }, (_, i) => {
    // Round robin across the heavy chapters, so the first and heaviest gets
    // the extra question when the count does not divide evenly.
    const pick = i % Math.max(1, groundings.length);
    const chapterId = heavy[pick]?.id ?? heavy[0]?.id ?? '';
    /*
     * Each question gets its own topic to sit on.
     *
     * The three calls run at once and cannot see each other, so two questions
     * drawn from the same chapter can land on the same idea and the paper
     * repeats itself. Handing each one a different topic from that chapter is
     * what keeps them apart. Advisory rather than binding: if a chapter has
     * fewer topics than questions the model still writes a whole question,
     * it just is not steered.
     */
    const pool = topicsByChapter.get(chapterId) ?? [];
    const topic = pool.length ? pool[taken++ % pool.length] : null;
    return { grounding: groundings[pick], chapterId, topic, count: 1 };
  }).filter((part) => part.grounding);

  try {
    const batches = await Promise.all(
      split.map(async (part) => {
        const response = await anthropic.messages.create({
          model: AI_MODEL,
          // Sized for this chapter's share of the paper, with headroom for
          // Urdu, which needs far more tokens to say the same thing.
          max_tokens: 2600 * part.count,
          output_config: { effort: 'medium', format: { type: 'json_schema', schema: LONG_SCHEMA } },
          system:
            `You write Section C long questions for an FBISE Class ${g.grade} (SSC-${g.grade === 10 ? 'II' : 'I'}) board paper. ${part.grounding.grounded ? 'Work ONLY from the chapter text provided.' : 'Follow the chapter brief provided.'} Each question demands an extended answer: derivations, multi-part numericals, explain-with-examples. Give a thorough model answer and 4 to 6 marking points showing where each mark is earned. ` +
            languageRule(medium),
          messages: [
            {
              role: 'user',
              content:
                `${groundingBrief(part.grounding, g.grade)}\n\n---\n` +
                `Write exactly ${part.count} long question${part.count === 1 ? '' : 's'} in board style.` +
                (part.topic
                  ? ` Build it around "${part.topic}". Other questions on this paper cover the chapter's other topics, so do not stray onto them.`
                  : ''),
            },
          ],
        });
        if (response.stop_reason === 'refusal') return null;
        const block = response.content.find((b) => b.type === 'text');
        if (!block) return null;
        const parsed = JSON.parse(block.text) as { items: { q: string; answer: string; points: string[]; marks: number }[] };
        return parsed.items.map((item) => ({ ...item, chapterId: part.chapterId }));
      }),
    );

    // A refusal on one chapter is not a failed paper. Sections A and B are
    // real board questions and stand on their own, so the paper still ships
    // with whatever Section C came back.
    const longQs = batches.filter(Boolean).flat() as { q: string; answer: string; points: string[]; marks: number; chapterId: string }[];
    if (!longQs.length) return NextResponse.json({ error: 'refused', quota: g.quota }, { status: 200 });

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

    const { data: saved, error } = await g.admin
      .from('ai_sessions')
      .insert({
        user_id: g.userId,
        kind: 'paper',
        title: `${subject.name} mock paper`,
        subject_id: subjectId,
        medium,
        items,
      })
      .select('id')
      .single();
    if (error || !saved) return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 500 });

    const quota = await chargeQuota(g, AI_COST.paper);
    return NextResponse.json({ sessionId: saved.id, items, quota });
  } catch (e) {
    console.error('[mock-paper]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 502 });
  }
}
