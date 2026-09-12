import { type EmailOtpType } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { safePath } from '@/lib/safe-path';
import { createClient } from '@/lib/supabase/server';

/**
 * Where a one-time sign-in link lands.
 *
 * Separate from /auth/callback, which exchanges a `code`. That flow is PKCE:
 * it needs a verifier stored by the browser that started it, so it cannot work
 * for a link generated on the server and opened somewhere else. This is the
 * whole point of the upgrade link, which is created on a student's phone and
 * opened in their browser.
 *
 * The token hash flow has no such requirement. The token is single use and
 * short lived, and verifying it here is what mints the session cookie.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;

  // A path on this site, never a full URL, or the link becomes an open
  // redirect that happens to log you in first.
  const next = safePath(url.searchParams.get('next'));

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL('/login?error=link', url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    // Used once already, or expired. Both are ordinary: say so plainly rather
    // than showing a student a failure they cannot act on. A recovery link
    // goes to the reset request form, where a fresh one is a press away.
    const failed = type === 'recovery' ? '/forgot?error=expired' : '/login?error=expired';
    return NextResponse.redirect(new URL(failed, url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
