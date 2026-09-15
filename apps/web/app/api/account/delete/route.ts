import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * A student deleting their own account, from either app.
 *
 * The website sends its session cookie; the Android app sends its access
 * token, as it does for the AI routes. Either way the deleting is done here
 * with the server key: a client session can remove nothing of the login
 * account by itself, only ask for its own to go.
 *
 * Deleting the login account takes everything that belongs to the student
 * with it (every study table cascades from auth.users). Payments stay, with
 * no one attached, because the accounts must add up; the teacher they earned
 * a commission for is written on the payment itself (migration 0048).
 *
 * Staff accounts are not deleted this way: a teacher has students, earnings
 * and payouts hanging off their account, and the admin closes those by hand.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const admin = createAdminClient();
  const bearer = req.headers.get('authorization');
  const viaApp = !!bearer?.startsWith('Bearer ');

  let userId: string | null = null;
  if (viaApp) {
    const { data, error } = await admin.auth.getUser(bearer!.slice(7));
    userId = !error && data.user ? data.user.id : null;
  } else {
    const { data } = await (await createClient()).auth.getUser();
    userId = data.user?.id ?? null;
  }
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { confirm?: unknown } | null;
  if (body?.confirm !== 'DELETE') return NextResponse.json({ error: 'confirm' }, { status: 400 });

  const [{ data: profile, error: profileError }, { count: paid, error: paidError }] = await Promise.all([
    admin.from('profiles').select('role, referred_by').eq('id', userId).maybeSingle(),
    admin.from('payments').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'paid'),
  ]);
  if (profileError || paidError) {
    console.error('[account/delete] read failed', (profileError ?? paidError)?.message);
    return NextResponse.json({ error: 'server_error' }, { status: 503 });
  }
  if (profile?.role && profile.role !== 'student') return NextResponse.json({ error: 'staff' }, { status: 403 });

  const { error: logError } = await admin
    .from('account_deletions')
    .insert({ had_paid: (paid ?? 0) > 0, referred: !!profile?.referred_by, via: viaApp ? 'app' : 'web' });
  if (logError) console.error('[account/delete] could not log the deletion', logError.message);

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error('[account/delete] delete failed', error.message);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  // The website's cookies still hold a session for an account that no longer
  // exists. Clear them here so the next page is a signed-out one.
  if (!viaApp) await (await createClient()).auth.signOut({ scope: 'local' }).catch(() => {});
  return NextResponse.json({ ok: true });
}
