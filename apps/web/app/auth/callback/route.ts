import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { safePath } from '@/lib/safe-path';
import { createClient } from '@/lib/supabase/server';

/**
 * Where every email link lands: password recovery today, address confirmation
 * if it is switched back on.
 *
 * Three shapes of link can arrive here, and which one depends on who asked for
 * it and how the Supabase email template is written, not on anything in this
 * app. So all three are handled, and the template can change without a
 * deploy.
 *
 *   `?code=`   PKCE. The website's own requests make these. Exchanging the
 *              code needs the verifier cookie left on the browser that asked,
 *              so it only works there.
 *   `?token_hash=&type=`   A template that links straight here. Verified on
 *              the server with nothing stored beforehand, so it works on any
 *              device, the same flow /auth/confirm uses.
 *   neither    The Android app asks for resets with the implicit flow, which
 *              puts the session in the URL fragment. A server never sees a
 *              fragment, but the browser carries it across a redirect, so a
 *              recovery goes on to /reset, where the form reads it.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;
  const code = params.get('code');
  const tokenHash = params.get('token_hash');
  const type = params.get('type') as EmailOtpType | null;

  // Same rule as the login form: a path on this site, never a full URL, or the
  // reset email becomes a redirect anyone can point wherever they like.
  const next = safePath(params.get('next'));
  const recovery = type === 'recovery' || next === '/reset';

  /*
   * Where a failure goes, and what it says. "Expired" only when Supabase says
   * so: a PKCE link opened in a different browser from the one that asked is
   * not expired, and telling a student it was sent them to ask for another
   * link and open it in the same wrong place.
   */
  const failTo = (expired: boolean) =>
    NextResponse.redirect(
      new URL(recovery ? `/forgot?error=${expired ? 'expired' : 'link'}` : '/login?error=link', url.origin),
    );
  const isExpiry = (errorCode: string | null | undefined) =>
    errorCode === 'otp_expired' || errorCode === 'flow_state_expired';

  // Supabase reports a link it has already refused on the way here.
  if (params.get('error') || params.get('error_code')) return failTo(isExpiry(params.get('error_code')));

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    // Used once already, or expired. Both are ordinary, so say so plainly
    // rather than showing a stack trace to a student who clicked an old email.
    if (error) return failTo(true);
    return NextResponse.redirect(new URL(next, url.origin));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return failTo(error.code !== 'pkce_code_verifier_not_found');
    return NextResponse.redirect(new URL(next, url.origin));
  }

  // No code and no hash: an implicit-flow recovery, whose session is in the
  // fragment. /reset reads it; if there is none, saving says the link expired.
  if (recovery) return NextResponse.redirect(new URL('/reset', url.origin));
  return failTo(false);
}
