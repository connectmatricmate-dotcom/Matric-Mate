import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { cache } from 'react';

/**
 * Supabase in a Server Component, a server action or a route handler.
 *
 * Next 16 makes `cookies()` async, so this is too. Never hoist the client to
 * module scope: it is per-request, and a shared one would hand one student's
 * session to whoever asked next.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Components cannot set cookies. That is fine: proxy.ts
            // refreshes the session on every request, so the write is not lost.
          }
        },
      },
    }
  );
}

/**
 * Who is asking, verified.
 *
 * `getUser()` and never `getSession()`: getSession trusts the cookie as it
 * arrives, so a forged one passes. getUser checks it with Supabase. Wrapped in
 * React.cache so ten components asking during one render cost one round trip.
 */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
