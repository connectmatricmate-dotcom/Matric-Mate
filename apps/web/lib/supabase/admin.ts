import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * The admin client. Bypasses Row Level Security completely.
 *
 * This is the one file allowed to touch the secret key, and `server-only` makes
 * importing it from a client component a build error rather than a breach. Use
 * it for exactly two things: the payment webhook writing entitlements, and
 * anything else that must act with no user session at all.
 *
 * If you are reaching for this to "make a query work", the query is wrong.
 * Everything a student does should run under their own session, so RLS is doing
 * the access control rather than a hand-written filter someone can forget.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error('SUPABASE_SECRET_KEY is not set');

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
