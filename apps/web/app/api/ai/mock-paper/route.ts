import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { AI_COST, AI_MODEL, chapterGrounding, chargeQuota, guardAi } from '@/lib/ai/guard';

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
export const maxDuration = 60;

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
  ).filter(Boolean) as { title: string; text: string }[];

  try {
    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 6000,
      output_config: { format: { type: 'json_schema', schema: LONG_SCHEMA } },
      system:
        `You write Section C long questions for an FBISE Class ${g.grade} (SSC-${g.grade === 10 ? 'II' : 'I'}) board paper. Work ONLY from the chapter text provided. Each question demands an extended answer: derivations, multi-part numericals, explain-with-examples. Give a thorough model answer and 4 to 6 marking points showing where each mark is earned. ` +
        (medium === 'ur'
          ? 'Write in Urdu, keeping technical terms in English the way Pakistani textbooks do.'
          : 'Write in clear English at board register.'),
      messages: [
        {
          role: 'user',
          content: `${groundings.map((gr) => `Chapter: ${gr.title}\n${gr.text}`).join('\n\n---\n\n')}\n\n---\nWrite exactly ${LONG_COUNT} long questions in board style.`,
        },
      ],
    });
    if (response.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'refused', quota: g.quota }, { status: 200 });
    }
    const block = response.content.find((b) => b.type === 'text');
    if (!block) return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 502 });
    const longQs = (JSON.parse(block.text) as { items: { q: string; answer: string; points: string[]; marks: number }[] }).items;

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
      longQs: longQs.map((l, i) => ({ id: `lq-${i + 1}`, chapterId: heavy[0]?.id ?? '', ...l })),
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
