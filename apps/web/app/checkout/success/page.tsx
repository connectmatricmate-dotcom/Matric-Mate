import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { CheckoutOutcome } from '@/components/commerce/CheckoutOutcome';
import { confirmWithGateway } from '@/lib/payments';
import { createClient, getUser } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Payment', robots: { index: false } };

// Settles a payment and reads the result, so it must never be served from a cache.
export const dynamic = 'force-dynamic';

/**
 * What actually happened, read from the database rather than inferred from the
 * URL the browser arrived on.
 *
 * The row is fetched under the student's own session, so RLS makes "show me
 * someone else's payment" return nothing rather than rely on us remembering to
 * filter by user id.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ tracker?: string; status?: string }>;
}) {
  const { tracker, status: returnStatus } = await searchParams;
  const user = await getUser();

  let status: 'paid' | 'pending' | 'failed' | 'unknown' = 'unknown';
  let reference: string | null = null;
  let plan: string | null = null;
  let validTill: string | null = null;

  if (user && tracker) {
    /**
     * Ask the gateway directly before reading our own row.
     *
     * The webhook is supposed to have settled this already. On this merchant
     * account it never has, so a student who paid sat on "checking" while
     * Safepay's records showed the money taken and the fee deducted. Asking
     * costs one server-to-server call on a page nobody loads twice, and it
     * means access no longer depends on somebody else's webhook configuration.
     *
     * It settles nothing on its own: the amount must match the plan and the
     * payment must already belong to this student. If the webhook wins the
     * race, this is a no-op.
     */
    await confirmWithGateway({ tracker, userId: user.id }).catch((err) => {
      // Never fail the page over this. The worst case is the old behaviour.
      console.error('checkout/success: gateway confirm failed', err);
    });

    const supabase = await createClient();
    const [{ data: payment }, { data: entitlement }] = await Promise.all([
      supabase.from('payments').select('status, reference, plan').eq('tracker', tracker).maybeSingle(),
      supabase.from('entitlements').select('active, plan, valid_till').eq('user_id', user.id).maybeSingle(),
    ]);

    if (payment) {
      status = payment.status === 'paid' ? 'paid' : payment.status === 'pending' ? 'pending' : 'failed';
      reference = payment.reference;
      plan = payment.plan;
    }
    if (entitlement?.active) validTill = entitlement.valid_till;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-[980px] items-center px-5 py-3.5">
          <Link href="/" aria-label="MatricMate home">
            <Image src="/brand/wordmark.png" alt="MatricMate" width={140} height={28} priority />
          </Link>
        </div>
      </header>

      <CheckoutOutcome
        status={status}
        // The signature only ever proved Safepay sent the browser here. It is
        // worth surfacing when it fails, but it never decides access.
        signatureOk={returnStatus !== 'unverified'}
        reference={reference}
        plan={plan}
        validTill={validTill}
      />
    </div>
  );
}
