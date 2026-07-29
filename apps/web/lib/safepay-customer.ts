import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { createCustomer } from '@/lib/safepay';

/**
 * The student's Safepay customer id, created once and reused after.
 *
 * Safepay's docs are blunt about why this matters: a second customer record for
 * someone who already exists splits their saved payment methods and their
 * transaction history, and reconciliation becomes guesswork. So the id is
 * written to the profile the first time and read from it ever after.
 *
 * Created lazily, at first checkout. Most students never reach one, and minting
 * a customer at sign-up would fill the merchant account with people who never
 * paid.
 *
 * Never fatal. A payment with no customer attached still completes; it is just
 * harder to trace later. Checkout must not fail because a directory write did.
 */
export async function ensureSafepayCustomer(input: {
  userId: string;
  email: string;
  name: string;
  phone: string;
}): Promise<string | null> {
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('safepay_customer_id')
    .eq('id', input.userId)
    .maybeSingle();

  if (profile?.safepay_customer_id) return profile.safepay_customer_id;

  const customerId = await createCustomer({ email: input.email, name: input.name, phone: input.phone });
  if (!customerId) return null;

  const { error } = await admin
    .from('profiles')
    .update({ safepay_customer_id: customerId })
    .eq('id', input.userId);

  // If two checkouts raced, the unique index rejects the loser. Re-read rather
  // than overwrite: the row that won is the one Safepay will report against.
  if (error) {
    const { data: latest } = await admin
      .from('profiles')
      .select('safepay_customer_id')
      .eq('id', input.userId)
      .maybeSingle();
    return latest?.safepay_customer_id ?? customerId;
  }

  return customerId;
}
