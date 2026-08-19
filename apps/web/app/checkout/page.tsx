import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Icon } from '@/components/ui/primitives';
import { CheckoutForm } from '@/components/commerce/CheckoutForm';
import { THE_PLAN, planById } from '@/lib/plans';
import { gateway } from '@/lib/gateway';
import { getUser } from '@/lib/supabase/server';
import { keepStaffOut } from '@/lib/roles';

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

  // A subscription buys chapters and an AI tutor. Neither a teacher on the
  // referral programme nor an administrator has any use for one, and a staff
  // account wandering into checkout is a wrong turn, not a sale.
  await keepStaffOut();
  const user = await getUser();

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-[980px] items-center gap-3 px-5 py-3.5">
          <Link href="/" aria-label="MatricMate home">
            <Image src="/brand/wordmark.png" alt="MatricMate" width={136} height={27} priority />
          </Link>
          <span className="ms-auto inline-flex items-center gap-1.5 text-[12.5px] font-extrabold text-ink2">
            <Icon name="lock" size={14} strokeWidth={2.4} className="text-green" />
            Secure checkout
          </span>
        </div>
      </header>

      <CheckoutForm
        plan={planById(plan ?? THE_PLAN.id)}
        live={gateway.isLive}
        configured={gateway.isConfigured}
        cancelled={cancelled === '1'}
        accountEmail={user?.email ?? null}
      />
    </div>
  );
}
