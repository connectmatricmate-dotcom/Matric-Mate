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
    '/study/:path*',
    '/practice/:path*',
    '/tutor/:path*',
    '/progress/:path*',
    '/learn/:path*',
    '/session/:path*',
    '/insights/:path*',
    '/account/:path*',
    '/notifications/:path*',
    '/checkout/:path*',
    '/login',
    '/signup',
  ],
};
