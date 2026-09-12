import { NextRequest, NextResponse } from 'next/server';
import { AI_QUOTA } from '@matricmate/core';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * The tutor's fuel gauge. The apps call this on screen load so the counter
 * a student sees is the server's number, not a local guess, and so the
 * "resets at midnight" line can show a real clock time.
 */
const TIMEZONE = 'Asia/Karachi';

function dayKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date());
}

function resetAt(): string {
  const now = new Date();
  const pkNow = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));
  const pkMidnight = new Date(pkNow);
  pkMidnight.setHours(24, 0, 0, 0);
  return new Date(now.getTime() + (pkMidnight.getTime() - pkNow.getTime())).toISOString();
}

export async function GET(req: NextRequest) {
  let userId: string | null = null;
  const bearer = req.headers.get('authorization');
  if (bearer?.startsWith('Bearer ')) {
    const { data } = await createAdminClient().auth.getUser(bearer.slice(7));
    userId = data.user?.id ?? null;
  } else {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  }
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin.from('ai_usage').select('used').eq('user_id', userId).eq('day', dayKey()).maybeSingle();
  // A failed read is not a fresh allowance: showing "50 left" to a student
  // who has used them all is a promise the next question breaks.
  if (error) return NextResponse.json({ error: 'server_error' }, { status: 503 });
  const used = data?.used ?? 0;
  const limit = AI_QUOTA.premium;
  return NextResponse.json({ limit, used, remaining: Math.max(0, limit - used), resetAt: resetAt() });
}
