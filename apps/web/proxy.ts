import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Next 16 renamed middleware.ts to proxy.ts. Same job.
 *
 * Runs only where a session decision is made: protected routes are refused
 * before they render, and login/signup bounce a signed-in student home.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /**
     * Only routes that need a session decision. The marketing pages, terms,
     * pricing and the auth callback never consult the session here, so running
     * middleware on them (and on every prefetch of them) costs a round trip
     * and protects nothing. Keep this list in step with PROTECTED + AUTH_ONLY
     * in lib/supabase/middleware.ts.
     */
    '/dashboard/:path*',
    '/dashboard',
    '/upgrade/:path*',
    '/upgrade',
    '/study/:path*',
    '/study',
    '/practice/:path*',
    '/practice',
    '/tutor/:path*',
    '/tutor',
    '/progress/:path*',
    '/progress',
    '/learn/:path*',
    '/learn',
    '/session/:path*',
    '/session',
    '/insights/:path*',
    '/insights',
    '/account/:path*',
    '/account',
    '/notifications/:path*',
    '/notifications',
    '/checkout/:path*',
    '/checkout',
    '/certificates/:path*',
    '/certificates',
    '/onboarding/:path*',
    '/onboarding',
    /*
     * The two staff areas. Here as much for the session refresh as for the
     * guard: their own layouts already turn away the wrong role, but without
     * middleware on the path the auth cookie is never renewed, so a teacher
     * reading their dashboard would eventually be signed out mid-page.
     */
    '/admin/:path*',
    '/admin',
    '/affiliate/:path*',
    '/affiliate',
    '/login',
    '/signup',
  ],
};
