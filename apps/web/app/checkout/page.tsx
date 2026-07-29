import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { CheckoutForm } from '@/components/commerce/CheckoutForm';
import { planById } from '@/lib/plans';
import { isSafepayConfigured } from '@/lib/safepay';
import { createClient, getUser } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Start your MatricMate Premium plan. Pay by JazzCash, Easypaisa or card.',
  robots: { index: false },
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; cancelled?: string }>;
}) {
  const { plan, cancelled } = await searchParams;

  // Asked once. A student who has paid before should not retype their number,
  // and the row is only readable by them, so RLS does the scoping.
  const user = await getUser();
  let knownPhone: string | null = null;
  if (user) {
    const supabase = await createClient();
    const { data } = await supabase.from('profiles').select('phone').eq('id', user.id).maybeSingle();
    knownPhone = data?.phone ?? null;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-[980px] items-center gap-3 px-5 py-3.5">
          <Link href="/" aria-label="MatricMate home">
            <Image src="/brand/wordmark.png" alt="MatricMate" width={140} height={28} priority />
          </Link>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[12.5px] font-extrabold text-ink2">
            🔒 Secure checkout
          </span>
        </div>
      </header>

      <CheckoutForm
        plan={planById(plan ?? 'quarter')}
        live={isSafepayConfigured}
        cancelled={cancelled === '1'}
        knownPhone={knownPhone}
      />
    </div>
  );
}
