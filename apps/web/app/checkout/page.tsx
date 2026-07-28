import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { CheckoutForm } from '@/components/commerce/CheckoutForm';
import { planById } from '@/lib/plans';

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Start your MatricMate Premium plan. Three days free, then pay by JazzCash, EasyPaisa or card.',
  robots: { index: false },
};

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;

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

      <CheckoutForm plan={planById(plan ?? 'quarter')} />
    </div>
  );
}
