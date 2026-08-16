import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { AI_COST, AI_MODEL, chapterGrounding, chargeQuota, guardAi } from '@/lib/ai/guard';

/**
 * The cheat-sheet maker: a one-page revision sheet per chapter. The sheet is
 * the same for every student, so it is cached GLOBALLY per chapter and
 * medium in cheat_sheets: the first student's request pays the one model
 * call, everyone after reads it free, and a cached hit does not touch the
 * requester's quota either.
 */
export const maxDuration = 60;

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  const g = await guardAi(req, AI_COST.sheet);
  if (g instanceof NextResponse) return g;

  let body: { chapterId?: string; medium?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const chapterId = (body.chapterId ?? '').slice(0, 40);
  const medium = body.medium === 'ur' ? 'ur' : 'en';
  if (!chapterId) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const { data: cached } = await g.admin
    .from('cheat_sheets')
    .select('body')
    .eq('chapter_id', chapterId)
    .eq('medium', medium)
    .maybeSingle();
  if (cached) return NextResponse.json({ sheet: cached.body, cached: true, quota: g.quota });

  const grounding = await chapterGrounding(g.admin, chapterId, medium, 24_000, g.grade);
  if (!grounding) return NextResponse.json({ error: 'no_content' }, { status: 404 });

  try {
    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 3000,
      output_config: { effort: 'low' },
      system:
        `You write one-page revision sheets for FBISE Class ${g.grade} (SSC-${g.grade === 10 ? 'II' : 'I'}) students, from ONLY the chapter text provided. Structure, in this order: KEY DEFINITIONS (term: one line each), FORMULAS with what each symbol means (skip the section if the chapter has none), MUST-KNOW POINTS (the facts examiners ask), COMMON MISTAKES (2 or 3), LIKELY EXAM QUESTIONS (3, just the questions). Plain text only: capitalised section headings, hyphen bullets, no markdown symbols, no tables. Tight enough to revise in ten minutes. Never use an em dash; use a comma, a colon, or a new sentence. ` +
        (medium === 'ur'
          ? 'Write in Urdu, keeping technical terms in English the way Pakistani textbooks do.'
          : 'Write in clear, simple English.'),
      messages: [{ role: 'user', content: `Chapter: ${grounding.title}\n\n${grounding.text}` }],
    });
    if (response.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'refused', quota: g.quota }, { status: 200 });
    }
    const block = response.content.find((b) => b.type === 'text');
    const sheet = block?.text.trim();
    if (!sheet) return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 502 });

    // Two students can race here; the second insert loses quietly and both
    // get the same sheet, which is exactly what should happen.
    await g.admin.from('cheat_sheets').upsert({ chapter_id: chapterId, medium, body: sheet }, { onConflict: 'chapter_id,medium' });
    const quota = await chargeQuota(g, AI_COST.sheet);
    return NextResponse.json({ sheet, cached: false, quota });
  } catch (e) {
    console.error('[cheat-sheet]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 502 });
  }
}
