import { NextRequest, NextResponse } from 'next/server';
import { channelStatus } from '@/lib/notify';
import { diagnosePush } from '@/lib/notify/channels/push';
import { cronAuthorised } from '@/lib/notify/jobs';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Which delivery channels are actually wired up on this deployment.
 *
 * Every channel reports `unconfigured` rather than failing when its
 * credentials are missing, which is the right behaviour and also means a
 * missing environment variable is completely silent: notifications simply
 * stop reaching phones and nothing anywhere says so. This is how to ask.
 *
 * Behind CRON_SECRET like the jobs, because it names which integrations exist
 * and how many devices are registered, which is nobody else's business. It
 * returns no values, only whether each one is present.
 */
export async function GET(req: NextRequest) {
  if (!cronAuthorised(req)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { count } = await admin.from('push_tokens').select('*', { count: 'exact', head: true });

  return NextResponse.json({
    channels: channelStatus(),
    // `?push=check` walks a real send without delivering anything: see diagnosePush.
    ...(req.nextUrl.searchParams.get('push') === 'check' ? { push: await diagnosePush() } : {}),
    registeredDevices: count ?? 0,
    // Named so a missing one is obvious at a glance rather than inferred from
    // a channel being off.
    missing: [
      ...(process.env.FIREBASE_PROJECT_ID ? [] : ['FIREBASE_PROJECT_ID']),
      ...(process.env.FIREBASE_CLIENT_EMAIL ? [] : ['FIREBASE_CLIENT_EMAIL']),
      ...(process.env.FIREBASE_PRIVATE_KEY ? [] : ['FIREBASE_PRIVATE_KEY']),
      ...(process.env.RESEND_API_KEY ? [] : ['RESEND_API_KEY']),
      ...(process.env.EMAIL_FROM ? [] : ['EMAIL_FROM']),
    ],
  });
}
