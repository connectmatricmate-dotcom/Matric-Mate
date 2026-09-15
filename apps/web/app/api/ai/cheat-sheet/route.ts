import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { BOARD_LABEL, asBoard, subjectMedium } from '@matricmate/core';
import {
  AI_COST,
  AI_MODEL,
  chapterGrounding,
  chargeQuota,
  groundingBrief,
  guardStudent,
  outsideTrial,
  reserveQuota,
  refused,
  studentMedium,
  noteAiFailure,
} from '@/lib/ai/guard';
import { languageRule } from '@/lib/ai/language';

/**
 * The cheat-sheet maker: a one-page revision sheet per chapter. The sheet is
 * the same for every student, so it is cached GLOBALLY per chapter and
 * language in cheat_sheets: the first student's request pays the one model
 * call, everyone after reads it free, and a cached hit does not touch the
 * requester's quota either.
 *
 * The order of the checks is the point. Who is asking and whether they have a
 * plan come first, then whether the chapter is in their own board and class,
 * then the cache, and quota only once we know a model call is needed. Quota
 * used to come first, so a student who had spent the day's allowance could not
 * open even a sheet that costs nothing, and was told to check their
 * connection.
 */
export const maxDuration = 300;

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  const g = await guardStudent(req);
  if (g instanceof NextResponse) return g;

  let body: { chapterId?: string; medium?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const chapterId = (body.chapterId ?? '').slice(0, 40);
  if (!chapterId) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  /*
   * The chapter must be theirs whether or not a sheet exists. The cache is
   * read with the admin client, which skips RLS, so without this any student
   * could read another board's or class's sheet by guessing its id.
   */
  const { data: chapter, error: chapterError } = await g.admin
    .from('chapters')
    .select('id,grade,board,subject_id')
    .eq('id', chapterId)
    .maybeSingle();
  if (chapterError) return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 503 });
  if (!chapter || chapter.grade !== g.grade || asBoard(chapter.board) !== g.board) {
    return NextResponse.json({ error: 'not_in_syllabus', quota: g.quota }, { status: 404 });
  }
  const shut = outsideTrial(g, chapter.subject_id as string);
  if (shut) return shut;

  /*
   * One sheet per chapter per LANGUAGE, not per medium. Urdu is written in
   * Urdu and English in English for every student, so keying on the medium
   * made two sheets of each language subject on the client's key, one of them
   * in the wrong language.
   */
  const medium = subjectMedium(chapterId, g.board, studentMedium(body.medium, g));

  const { data: cached, error: cacheError } = await g.admin
    .from('cheat_sheets')
    .select('body')
    .eq('chapter_id', chapterId)
    .eq('medium', medium)
    .maybeSingle();
  if (cacheError) return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 503 });
  if (cached) return NextResponse.json({ sheet: cached.body, cached: true, quota: g.quota });

  const denied = await reserveQuota(g, AI_COST.sheet);
  if (denied) return denied;

  try {
    const grounding = await chapterGrounding(g.admin, chapterId, medium, 24_000, g.grade, g.board);
    if (!grounding) return NextResponse.json({ error: 'not_in_syllabus', quota: g.quota }, { status: 404 });

    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 4000,
      output_config: { effort: 'low' },
      system:
        `You write one-page revision sheets for ${BOARD_LABEL[g.board]} Class ${g.grade} (SSC-${g.grade === 10 ? 'II' : 'I'}) students, ${grounding.grounded ? 'from ONLY the chapter text provided.' : 'from the chapter brief provided.'} Structure, in this order: KEY DEFINITIONS (term: one line each), FORMULAS with what each symbol means (skip the section if the chapter has none), MUST-KNOW POINTS (the facts examiners ask), COMMON MISTAKES (2 or 3), LIKELY EXAM QUESTIONS (3, just the questions). Plain text only: capitalised section headings, hyphen bullets, no markdown symbols, no tables. Tight enough to revise in ten minutes. Never use an em dash; use a comma, a colon, or a new sentence. ` +
        languageRule(medium, g.grade, g.board),
      messages: [{ role: 'user', content: groundingBrief(grounding, g.grade, g.board) }],
    });
    if (response.stop_reason === 'refusal') return refused(g.quota);
    // A sheet cut off at its length limit is not cached: every student on the
    // chapter would read the same half sheet, with nothing to regenerate it.
    // Not charged either (the hold is given back), and the next open retries.
    if (response.stop_reason === 'max_tokens') {
      console.error('[cheat-sheet] cut off at the token limit', chapterId, medium);
      return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 502 });
    }
    const block = response.content.find((b) => b.type === 'text');
    // Asking is not enough: the model still slips one in now and then, and a
    // cached sheet is read by every student on that chapter. A dash between
    // words becomes a comma (the Urdu one in Urdu), and one opening a line
    // becomes the hyphen bullet the sheet uses everywhere else.
    const comma = medium === 'ur' ? '، ' : ', ';
    const sheet = block?.text
      .replace(/^(\s*)\u2014\s*/gm, '$1- ')
      .replace(/\s*\u2014\s*/g, comma)
      .trim();
    if (!sheet) return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 502 });

    // Two students can race here; the second write lands on the same row and
    // both get a sheet, which is exactly what should happen. A failed write
    // still hands this student the sheet they waited for, and the next
    // student pays for it again rather than getting nothing.
    const { error: saveError } = await g.admin
      .from('cheat_sheets')
      .upsert({ chapter_id: chapterId, medium, body: sheet }, { onConflict: 'chapter_id,medium' });
    if (saveError) console.error('[cheat-sheet] cache write failed', saveError.message);
    const quota = await chargeQuota(g, AI_COST.sheet);
    return NextResponse.json({ sheet, cached: false, quota });
  } catch (e) {
    console.error('[cheat-sheet]', e instanceof Error ? e.message : e);
    await noteAiFailure(e);
    return NextResponse.json({ error: 'server_error', quota: g.quota }, { status: 502 });
  }
}
