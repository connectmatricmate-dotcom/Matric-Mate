import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { BOARD_LABEL, subjectMedium } from '@matricmate/core';
import { AI_COST, AI_MODEL, chapterGrounding, chargeQuota, groundingBrief, guardAi, outsideTrial, refused, studentMedium, noteAiFailure } from '@/lib/ai/guard';
import { languageRule } from '@/lib/ai/language';

/**
 * The AI session builder: a student picks a chapter, a practice type and a
 * count, and gets a fresh set written for them on the spot.
 *
 * Two rules keep this honest. Generation is GROUNDED: the model writes from
 * our own published chapter text, passed in full, so questions come from the
 * student's actual syllabus and not the model's memory of some other
 * curriculum. And generated sets are PERSONAL: saved to ai_sessions under
 * the student's id, labelled AI-made in the UI, never mixed into the
 * human-reviewed shared bank.
 */
export const maxDuration = 300;

const anthropic = new Anthropic();

const KINDS = ['mcq', 'flashcards', 'blanks', 'shortq'] as const;
type Kind = (typeof KINDS)[number];

/** One schema per practice type, matching the app's own item shapes. */
const ITEM_SCHEMAS: Record<Kind, Record<string, unknown>> = {
  mcq: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            q: { type: 'string' },
            options: { type: 'array', items: { type: 'string' } },
            answer: { type: 'integer', enum: [0, 1, 2, 3] },
            explanation: { type: 'string' },
            difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
          },
          required: ['q', 'options', 'answer', 'explanation', 'difficulty'],
          additionalProperties: false,
        },
      },
    },
    required: ['items'],
    additionalProperties: false,
  },
  flashcards: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: { front: { type: 'string' }, back: { type: 'string' } },
          required: ['front', 'back'],
          additionalProperties: false,
        },
      },
    },
    required: ['items'],
    additionalProperties: false,
  },
  blanks: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            before: { type: 'string' },
            after: { type: 'string' },
            answer: { type: 'string' },
            options: { type: 'array', items: { type: 'string' } },
          },
          required: ['before', 'after', 'answer', 'options'],
          additionalProperties: false,
        },
      },
    },
    required: ['items'],
    additionalProperties: false,
  },
  shortq: {
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
            marks: { type: 'integer', enum: [2, 3, 4, 5] },
          },
          required: ['q', 'answer', 'points', 'marks'],
          additionalProperties: false,
        },
      },
    },
    required: ['items'],
    additionalProperties: false,
  },
};

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/**
 * Only items a student can actually answer. "Exactly 4 options, one of them
 * the answer" is an instruction to the model, not a guarantee: a blank whose
 * answer is not among its options can never be marked right, and an MCQ with
 * three options or a blank question is a broken screen. Those are dropped,
 * and a blank missing its answer from the options has it put in.
 */
function sound(kind: Kind, items: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const it of items) {
    if (!it || typeof it !== 'object') continue;
    const o = it as Record<string, unknown>;
    if (kind === 'mcq') {
      const options = Array.isArray(o.options) ? o.options.map(text) : [];
      const answer = Number(o.answer);
      if (!text(o.q) || options.length !== 4 || options.some((x) => !x) || new Set(options).size !== 4) continue;
      if (!Number.isInteger(answer) || answer < 0 || answer > 3) continue;
      out.push({ ...o, q: text(o.q), options, answer });
    } else if (kind === 'flashcards') {
      if (!text(o.front) || !text(o.back)) continue;
      out.push({ front: text(o.front), back: text(o.back) });
    } else if (kind === 'blanks') {
      const answer = text(o.answer);
      let options = [...new Set((Array.isArray(o.options) ? o.options.map(text) : []).filter(Boolean))];
      if (!answer || (!text(o.before) && !text(o.after))) continue;
      // Put in where it cannot be spotted by its place in the row.
      if (!options.includes(answer)) options = [...options.slice(0, 3), answer].sort(() => Math.random() - 0.5);
      if (options.length < 2) continue;
      out.push({ ...o, answer, options });
    } else {
      const points = (Array.isArray(o.points) ? o.points.map(text) : []).filter(Boolean);
      if (!text(o.q) || !text(o.answer)) continue;
      out.push({ ...o, q: text(o.q), answer: text(o.answer), points });
    }
  }
  return out;
}

const KIND_BRIEF: Record<Kind, string> = {
  mcq: 'multiple-choice questions with exactly 4 options each, one correct, distractors drawn from common student mistakes, and a one-or-two sentence explanation',
  flashcards: 'flashcards: front is a term, definition prompt or short question; back is the concise answer a student should recall',
  blanks:
    'fill-in-the-blank sentences: split each sentence into the text before the blank and after it, give the answer word or phrase, and exactly 4 options including the answer',
  shortq:
    'short exam questions in board style, each with a model answer of 2 to 4 sentences and 2 to 4 marking points the examiner awards marks for',
};

export async function POST(req: NextRequest) {
  const g = await guardAi(req, AI_COST.session);
  if (g instanceof NextResponse) return g;

  let body: { kind?: string; chapterId?: string; topic?: string; count?: number; medium?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const kind = KINDS.find((k) => k === body.kind);
  const chapterId = (body.chapterId ?? '').slice(0, 40);
  if (!kind || !chapterId) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const count = Math.min(15, Math.max(3, Number(body.count) || 8));
  // The subject's own language: an Urdu chapter is written in Urdu and an
  // English one in English, whichever medium the student reads in.
  const medium = subjectMedium(chapterId, g.board, studentMedium(body.medium, g));
  const topic = (body.topic ?? '').slice(0, 120);

  try {
    const grounding = await chapterGrounding(g.admin, chapterId, medium, 24_000, g.grade, g.board);
    // Null only means the chapter does not exist, or belongs to another class
    // or board. Its own reason, so the app can say that rather than "try
    // again", which never helps. A chapter with no text of ours still builds,
    // from the syllabus.
    if (!grounding) return NextResponse.json({ error: 'not_in_syllabus', quota: g.quota }, { status: 404 });
    const shut = outsideTrial(g, grounding.subjectId);
    if (shut) return shut;

    const response = await anthropic.messages.create({
      model: AI_MODEL,
      // Twelve short questions with model answers in Urdu ran past 8,000.
      max_tokens: 12000,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: ITEM_SCHEMAS[kind] } },
      system:
        `You write practice material for ${BOARD_LABEL[g.board]} Class ${g.grade} students (SSC-${g.grade === 10 ? 'II' : 'I'}, Pakistan). ${grounding.grounded ? 'Work ONLY from the chapter text the user provides: every item must be answerable from it.' : 'Follow the chapter brief the user provides.'} Match the board register. Plain text only: no markdown headings, no asterisks or bold markers. Never use an em dash; use a comma, a colon, or a new sentence. ` +
        languageRule(medium, g.grade, g.board),
      messages: [
        {
          role: 'user',
          content: `${groundingBrief(grounding, g.grade, g.board)}\n\n---\nWrite exactly ${count} ${KIND_BRIEF[kind]}${topic ? `, focused on "${topic}"` : ''}. Mixed difficulty.`,
        },
      ],
    });
    if (response.stop_reason === 'refusal') return refused(g.quota);
    // Cut off mid-set, the JSON is unfinished and cannot be parsed. Said here
    // so the log names the cause instead of a parse error.
    if (response.stop_reason === 'max_tokens') {
      console.error('[generate-session] ran out of tokens', { kind, count, medium });
      return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 502 });
    }
    const block = response.content.find((b) => b.type === 'text');
    if (!block) return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 502 });
    const raw = (JSON.parse(block.text) as { items: unknown[] }).items;
    const items = Array.isArray(raw) ? sound(kind, raw) : [];
    if (!items.length) {
      return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 502 });
    }

    const { data: saved, error } = await g.admin
      .from('ai_sessions')
      .insert({
        user_id: g.userId,
        kind,
        title: topic ? `${grounding.title} · ${topic}` : grounding.title,
        subject_id: grounding.subjectId || null,
        chapter_id: chapterId,
        topic: topic || null,
        medium,
        items,
      })
      .select('id')
      .single();
    if (error || !saved) {
      console.error('[generate-session] save failed', error?.message);
      return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 500 });
    }

    const quota = await chargeQuota(g, AI_COST.session);
    return NextResponse.json({ sessionId: saved.id, kind, items, quota });
  } catch (e) {
    console.error('[generate-session]', e instanceof Error ? e.message : e);
    await noteAiFailure(e);
    return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 502 });
  }
}
