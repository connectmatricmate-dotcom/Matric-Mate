import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase in the browser.
 *
 * Only the publishable key ever reaches here, and that is by design: it is in
 * the bundle, anyone can read it, and Row Level Security is what actually keeps
 * one student out of another's rows. Proven in supabase/migrations/0001_init.sql
 * and re-checked whenever a table is added.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
