import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { CheckoutSuccess } from '@/components/commerce/CheckoutSuccess';

export const metadata: Metadata = { title: 'Payment received', robots: { index: false } };

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; ref?: string; order?: string; tracker?: string }>;
}) {
  const { status, ref, order, tracker } = await searchParams;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-[980px] items-center px-5 py-3.5">
          <Link href="/" aria-label="MatricMate home">
            <Image src="/brand/wordmark.png" alt="MatricMate" width={140} height={28} priority />
          </Link>
        </div>
      </header>

      <CheckoutSuccess verified={status === 'ok'} reference={ref} orderId={order} tracker={tracker} />
    </div>
  );
}
