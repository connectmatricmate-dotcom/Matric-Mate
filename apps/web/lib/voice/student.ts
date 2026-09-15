import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { subjectOpen } from '@matricmate/core';
import { accessFromRow } from '@/lib/entitlement';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * Who may have a lesson read to them: a signed-in account whose plan opens
 * that lesson's subject. The same rule as the lesson's own audio file (row
 * level security on audio_tracks), applied here because the premium voice is
 * made on the server with the admin client and costs money per lesson.
 * Basic plays audio like everything else; a trial only its own subject; and
 * only chapters of the student's own class and board.
 * Cookies for the website, a bearer token for the app.
 */
export async function studentForLesson(req: NextRequest, chapter: string): Promise<{ userId: string } | NextResponse> {
  const admin = createAdminClient();
  let userId: string | null = null;
  const bearer = req.headers.get('authorization');
  if (bearer?.startsWith('Bearer ')) {
    const { data, error } = await admin.auth.getUser(bearer.slice(7));
    userId = !error && data.user ? data.user.id : null;
  } else {
    const { data } = await (await createClient()).auth.getUser();
    userId = data.user?.id ?? null;
  }
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const [{ data: ent, error }, { data: prof, error: pe }, { data: ch, error: ce }] = await Promise.all([
    admin.from('entitlements').select('active, valid_till, plan, trial_subject').eq('user_id', userId).maybeSingle(),
    admin.from('profiles').select('grade, board').eq('id', userId).maybeSingle(),
    admin.from('chapters').select('grade, board').eq('id', chapter).maybeSingle(),
  ]);
  if (error || pe || ce) return NextResponse.json({ error: 'server_error' }, { status: 503 });
  // A chapter id starts with its subject's.
  if (!subjectOpen(accessFromRow(ent), chapter.split('-')[0])) return NextResponse.json({ error: 'plan_required' }, { status: 402 });
  // Their own class and board only, as the audio rows are: a Class 9 plan
  // could otherwise have Class 10 and Punjab lessons made on the month's
  // voice allowance.
  if (!ch || ch.grade !== prof?.grade || ch.board !== prof?.board) return NextResponse.json({ error: 'not_in_syllabus' }, { status: 404 });
  return { userId };
}
