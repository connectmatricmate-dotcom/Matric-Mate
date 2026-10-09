import { NextRequest, NextResponse } from 'next/server';
import { onlinePayments } from '@/lib/gateway';
import { openPlanRequest, requestPremium } from '@/lib/plan-requests';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * A student asking for Premium while plans are switched on by hand
 * (lib/plan-requests.ts), from either app.
 *
 *   GET   the open request, if any: { request: { id, createdAt } | null }
 *   POST  ask: { state: 'requested' | 'pending', request } | { state: 'already' }
 *
 * The website sends its session cookie; the Android app sends its access
 * token, as it does for the AI routes and account deletion. The answer never
 * carries a price or an account number: the Android app reads it too
 * (core/billing.ts), and the website has its own copy of those.
 */
export const dynamic = 'force-dynamic';

async function caller(req: NextRequest): Promise<{ userId: string | null; viaApp: boolean }> {
  const bearer = req.headers.get('authorization');
  if (bearer?.startsWith('Bearer ')) {
    const { data, error } = await createAdminClient().auth.getUser(bearer.slice(7));
    return { userId: !error && data.user ? data.user.id : null, viaApp: true };
  }
  const { data } = await (await createClient()).auth.getUser();
  return { userId: data.user?.id ?? null, viaApp: false };
}

export async function GET(req: NextRequest) {
  const { userId } = await caller(req);
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  return NextResponse.json({ request: await openPlanRequest(userId) });
}

export async function POST(req: NextRequest) {
  const { userId, viaApp } = await caller(req);
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  // A live gateway takes payments itself; requests are for while it does not.
  if (onlinePayments()) return NextResponse.json({ error: 'online_payments' }, { status: 409 });

  const out = await requestPremium(userId, viaApp ? 'app' : 'web');
  if (out.state === 'staff') return NextResponse.json({ error: 'not_a_student' }, { status: 403 });
  if (out.state === 'error') return NextResponse.json({ error: 'server_error' }, { status: 503 });
  return NextResponse.json(out);
}
