import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  estimatedSecs,
  finalPath,
  loadLesson,
  publicUrl,
  readSettings,
  remainingChars,
  signStream,
  startPart,
  usedThisMonth,
  voiceReady,
  type Medium,
} from '@/lib/voice/lesson';
import { studentForLesson } from '@/lib/voice/student';

/**
 * Should this lesson be played from the premium-voice stream, and where is it.
 *
 * Asked by both apps when a student presses play on a lesson whose track says
 * its premium voice is still to come (audio_tracks.voice_pending), and again
 * from where they got to if the stream ends early. Answers one of:
 *
 *   { stream, estSecs }         play this, the lesson is made as it plays
 *   { url, durationSecs }       it is finished: play the file (seekable)
 *   { stream: null, reason }    play the file you have: the voice is off, the
 *                               lesson is not in scope, or this month's
 *                               allowance would not cover the rest of it
 *
 * Whatever the answer, the student hears a lesson.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const chapter = (q.get('chapter') ?? '').slice(0, 60);
  const medium = q.get('medium');
  if (!chapter || (medium !== 'en' && medium !== 'ur')) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  const at = Math.max(0, Math.round(Number(q.get('at')) || 0));

  const who = await studentForLesson(req, chapter);
  if (who instanceof NextResponse) return who;

  const admin = createAdminClient();
  const none = (reason: string) => NextResponse.json({ stream: null, reason });
  try {
    const settings = await readSettings(admin);
    if (!voiceReady(settings, medium as Medium)) return none('off');
    const lesson = await loadLesson(admin, chapter, medium as Medium, settings);
    if (!lesson) return none('not_in_scope');
    if (!lesson.pending) {
      const { data: track } = await admin.from('audio_tracks').select('duration_secs').eq('id', `${chapter}-${medium}`).maybeSingle();
      return NextResponse.json({ stream: null, reason: 'finished', url: publicUrl(admin, finalPath(lesson)), durationSecs: Number(track?.duration_secs) || 0 });
    }
    // Asked again from the very end of a lesson that is made but not yet
    // joined into its file: that was the end, there is nothing more to play.
    if (at > 0 && startPart(lesson, at) >= lesson.parts.length) return none('end');
    // Only a lesson this month can finish: half a lesson in one voice and
    // the other half cut off is worse than the old voice all the way through.
    const remaining = remainingChars(lesson);
    if (remaining > 0 && (await usedThisMonth(admin)) + remaining > settings.monthlyChars) return none('budget');
    const token = signStream(chapter, medium as Medium, who.userId);
    const stream = `${req.nextUrl.origin}/api/audio/voice/stream?${token}${at ? `&at=${at}` : ''}`;
    return NextResponse.json({ stream, estSecs: estimatedSecs(lesson) });
  } catch (err) {
    console.error('[voice] manifest failed', err instanceof Error ? err.message : err);
    return none('error');
  }
}
