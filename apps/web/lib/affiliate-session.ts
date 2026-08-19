import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { affiliateByUserId } from '@/lib/affiliates';

/**
 * The signed-in teacher's own affiliate row.
 *
 * Three pages need it now that the area has tabs, and each of them would
 * otherwise repeat the same session read and the same not-found. Wrapped in
 * `React.cache`, so a page that asks and a component under it that asks again
 * still cost one query per render.
 */
export const currentAffiliate = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');

  const row = await affiliateByUserId(data.user.id);
  // An administrator reaching this page has no affiliate row of their own.
  if (!row) notFound();
  return row;
});
