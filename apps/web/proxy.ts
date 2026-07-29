import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * Next 16 renamed middleware.ts to proxy.ts. Same job.
 *
 * Every request passes through here so the auth token stays fresh and protected
 * routes are refused before they render.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /**
     * Everything except static assets and image files. Running auth on a
     * favicon request costs a round trip and protects nothing.
     */
    '/((?!_next/static|_next/image|favicon.ico|brand/|audio/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|ico)$).*)',
  ],
};
