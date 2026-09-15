import { NextRequest, NextResponse } from 'next/server';
import { cronAuthorised } from '@/lib/notify/jobs';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  claimPart,
  failPart,
  finalize,
  openLesson,
  readyRow,
  remainingChars,
  savePart,
  speak,
  usedThisMonth,
  voiceReady,
  type Medium,
} from '@/lib/voice/lesson';

/**
 * Makes a lesson's premium voice ahead of any student, for the lessons worth
 * having ready before anyone presses play. Server to server only (the cron
 * secret), driven by scripts/warm-voices.mjs one lesson at a time: each call
 * makes what it can in the time it has and says whether the lesson is done,
 * and the script calls again until it is.
 *
 *   POST { chapter, medium }  ->  { done, parts, made, remainingChars }
 */
export const maxDuration = 300;
const TIME_BUDGET_MS = 240_000;

export async function POST(req: NextRequest) {
  if (!cronAuthorised(req)) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  let body: { chapter?: string; medium?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const chapter = (body.chapter ?? '').slice(0, 60);
  const medium = body.medium;
  if (!chapter || (medium !== 'en' && medium !== 'ur')) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const admin = createAdminClient();
  const { settings, lesson } = await openLesson(admin, chapter, medium as Medium);
  if (!voiceReady(settings, medium as Medium)) return NextResponse.json({ error: 'voice_off' }, { status: 503 });
  if (!lesson) return NextResponse.json({ error: 'not_in_scope' }, { status: 404 });
  if (!lesson.pending) return NextResponse.json({ done: true, parts: lesson.parts.length, made: 0, remainingChars: 0 });

  const started = Date.now();
  let made = 0;
  try {
    for (const part of lesson.parts) {
      if (Date.now() - started > TIME_BUDGET_MS) break;
      if (readyRow(lesson, part)) continue;
      if ((await usedThisMonth(admin)) + part.text.length > settings.monthlyChars) {
        return NextResponse.json({ error: 'budget', done: false, parts: lesson.parts.length, made, remainingChars: remainingChars(lesson) }, { status: 402 });
      }
      // A student's stream may be making this one right now; leave it to them.
      if (!(await claimPart(admin, lesson, part))) continue;
      try {
        await savePart(admin, lesson, part, await speak(lesson, part, () => {}));
        // Joining and saving the parts is done below, once, for the lesson.
        made += 1;
      } catch (err) {
        await failPart(admin, lesson, part);
        throw err;
      }
    }
    const done = await finalize(admin, lesson);
    return NextResponse.json({ done, parts: lesson.parts.length, made, remainingChars: remainingChars(lesson) });
  } catch (err) {
    console.error('[voice] warm failed', chapter, medium, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'failed', message: err instanceof Error ? err.message : String(err), made }, { status: 500 });
  }
}
