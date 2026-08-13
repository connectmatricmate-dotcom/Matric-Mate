import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { AI_COST, AI_MODEL, chapterGrounding, chargeQuota, guardAi } from '@/lib/ai/guard';

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
export const maxDuration = 60;

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
  const medium = body.medium === 'ur' ? 'ur' : 'en';
  const topic = (body.topic ?? '').slice(0, 120);

  const grounding = await chapterGrounding(g.admin, chapterId, medium);
  if (!grounding) return NextResponse.json({ error: 'no_content' }, { status: 404 });

  try {
    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 8000,
      output_config: { format: { type: 'json_schema', schema: ITEM_SCHEMAS[kind] } },
      system:
        'You write practice material for FBISE Class 9 students (SSC-I, Pakistan). Work ONLY from the chapter text the user provides: every item must be answerable from it. Match the board register. ' +
        (medium === 'ur'
          ? 'Write in Urdu, keeping technical terms in English the way Pakistani textbooks do.'
          : 'Write in clear, simple English suited to a 14-year-old.'),
      messages: [
        {
          role: 'user',
          content: `Chapter: ${grounding.title}\n\n${grounding.text}\n\n---\nWrite exactly ${count} ${KIND_BRIEF[kind]}${topic ? `, focused on "${topic}"` : ''}. Mixed difficulty.`,
        },
      ],
    });
    if (response.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'refused', quota: g.quota }, { status: 200 });
    }
    const block = response.content.find((b) => b.type === 'text');
    if (!block) return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 502 });
    const items = (JSON.parse(block.text) as { items: unknown[] }).items;
    if (!Array.isArray(items) || !items.length) {
      return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 502 });
    }

    const { data: chapterRow } = await g.admin.from('chapters').select('subject_id').eq('id', chapterId).maybeSingle();
    const { data: saved, error } = await g.admin
      .from('ai_sessions')
      .insert({
        user_id: g.userId,
        kind,
        title: topic ? `${grounding.title} · ${topic}` : grounding.title,
        subject_id: chapterRow?.subject_id ?? null,
        chapter_id: chapterId,
        topic: topic || null,
        medium,
        items,
      })
      .select('id')
      .single();
    if (error || !saved) return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 500 });

    const quota = await chargeQuota(g, AI_COST.session);
    return NextResponse.json({ sessionId: saved.id, kind, items, quota });
  } catch (e) {
    console.error('[generate-session]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 502 });
  }
}
