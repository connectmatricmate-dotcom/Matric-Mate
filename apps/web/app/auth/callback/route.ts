import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Where every email link lands: password recovery today, address confirmation
 * if it is switched back on.
 *
 * Supabase sends a one-time `code`. Exchanging it here, server-side, is what
 * turns it into a session cookie. Without this route the reset email is a link
 * to a page that cannot do anything with it.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  // Same rule as the login form: a path on this site, never a full URL, or the
  // reset email becomes a redirect anyone can point wherever they like.
  const requested = url.searchParams.get('next') ?? '';
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/dashboard';

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=link', url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Expired or already used. Both are ordinary, so say so plainly rather than
    // showing a stack trace to a student who clicked an old email.
    return NextResponse.redirect(new URL('/forgot?error=expired', url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
