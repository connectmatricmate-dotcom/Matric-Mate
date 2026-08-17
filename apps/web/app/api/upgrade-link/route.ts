import { NextRequest, NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * Hands the Android app a one-time link that opens the website already signed
 * in, on the upgrade page.
 *
 * Why it exists: a student can only pay on the website, and asking them to
 * type an email and password a second time, on a phone keyboard, in the middle
 * of deciding whether to buy, is where they give up.
 *
 * The email is read from the verified session, never from the request body.
 * That is the whole security of this endpoint: it can only ever mint a link
 * into the account that asked for it. Taking an email from the body would turn
 * this into "log me in as anyone", which is as bad as it sounds.
 *
 * The link Supabase returns is single use and expires on its own. It is still
 * a credential while it lives, so it goes to the caller over TLS and nowhere
 * else: it is not logged, not emailed, and not stored.
 */
export async function POST(req: NextRequest) {
  const admin = createAdminClient();

  // Cookies for the website, a bearer token for the app. Same pattern as the
  // AI routes, see lib/ai/guard.ts.
  let email: string | null = null;
  const bearer = req.headers.get('authorization');
  if (bearer?.startsWith('Bearer ')) {
    const { data, error } = await admin.auth.getUser(bearer.slice(7));
    email = !error ? (data.user?.email ?? null) : null;
  } else {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    email = data.user?.email ?? null;
  }

  if (!email) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = data?.properties?.hashed_token;

  if (error || !tokenHash) {
    // Fall back to the plain page rather than failing the student outright.
    // They will have to sign in, which is the old behaviour, not a dead end.
    return NextResponse.json({ url: `${SITE_URL}/upgrade` }, { status: 200 });
  }

  /*
   * Built here rather than using Supabase's own action_link, which points at
   * the auth server's verify endpoint and comes back through the PKCE `code`
   * flow. That flow needs a verifier held by the browser that started it, and
   * this link is created on a phone and opened somewhere else entirely.
   */
  const url = new URL('/auth/confirm', SITE_URL);
  url.searchParams.set('token_hash', tokenHash);
  url.searchParams.set('type', 'magiclink');
  url.searchParams.set('next', '/upgrade');

  return NextResponse.json({ url: url.toString() }, { status: 200 });
}
