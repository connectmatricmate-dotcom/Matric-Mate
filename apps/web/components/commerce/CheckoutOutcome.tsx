'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Btn } from '@/components/ui/controls';
import { Card, Icon, LinkBtn } from '@/components/ui/primitives';
import { planById } from '@/lib/plans';
import { useT } from '@/lib/store';

/**
 * Shows what the database says, and grants nothing itself.
 *
 * `pending` is the normal first state, not an error: the browser usually beats
 * the webhook back by a second or two. So the page waits and re-reads rather
 * than telling a student who has just paid that something went wrong.
 */
export function CheckoutOutcome({
  status,
  signatureOk,
  reference,
  plan,
  validTill,
}: {
  status: 'paid' | 'pending' | 'failed' | 'unknown';
  signatureOk: boolean;
  reference: string | null;
  plan: string | null;
  validTill: string | null;
}) {
  const t = useT();
  const router = useRouter();
  const [rechecking, startRecheck] = useTransition();
  const [waited, setWaited] = useState(0);

  // Re-read every 2s while the webhook is in flight, and give up after ~30s so
  // a genuinely stuck payment does not spin forever.
  useEffect(() => {
    if (status !== 'pending' || waited >= 15) return;
    const timer = setTimeout(() => {
      setWaited((n) => n + 1);
      router.refresh();
    }, 2000);
    return () => clearTimeout(timer);
  }, [status, waited, router]);

  if (status === 'paid') {
    const p = planById(plan ?? 'monthly');
    return (
      <main className="mx-auto max-w-[460px] px-5 py-16">
        <Card className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-greentint text-green">
            <Icon name="check" size={28} strokeWidth={2.6} />
          </span>
          <h1 className="mt-3 font-display text-[24px] text-ink">{t('checkout.paidTitle')}</h1>
          <p className="mt-1 text-[14px] leading-[1.6] text-ink2">
            {t('checkout.paidBody', {
              plan: p.name.toLowerCase(),
              date: validTill
                ? new Date(validTill).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                : t('checkout.periodEnd'),
            })}
          </p>
          {reference ? <p className="mt-3 text-[12.5px] text-ink3">{t('checkout.receiptRef', { ref: reference })}</p> : null}
          <div className="mt-5 flex flex-col gap-2.5">
            <LinkBtn title={t('checkout.startStudying')} href="/dashboard" />
            <LinkBtn title={t('account.paymentHistory')} href="/account/payments" variant="ghost" />
          </div>
        </Card>
      </main>
    );
  }

  if (status === 'pending') {
    const stuck = waited >= 15;
    return (
      <main className="mx-auto max-w-[460px] px-5 py-16">
        <Card className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-tealtint text-teal">
            <Icon name="refresh" size={26} className={stuck ? '' : 'animate-spin'} />
          </span>
          <h1 className="mt-3 font-display text-[22px] text-ink">
            {stuck ? t('checkout.stillConfirming') : t('checkout.confirming')}
          </h1>
          <p className="mt-1 text-[14px] leading-[1.6] text-ink2">
            {stuck ? t('checkout.stuckBody') : t('checkout.confirmingBody')}
          </p>
          {stuck ? (
            <div className="mt-5 flex flex-col gap-2.5">
              {/*
                Re-runs the page, which asks the gateway again. It used to look
                broken because the answer never changed while the payment sat
                unsettled; now it can actually resolve, and it says so while it
                is working.
              */}
              <Btn
                title={t('billing.checkAgain')}
                loading={rechecking}
                onClick={() => startRecheck(() => router.refresh())}
              />
              <LinkBtn title={t('account.help')} href="/account/help" variant="line" />
            </div>
          ) : null}
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[460px] px-5 py-16">
      <Card>
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-[16px] bg-redtint text-red">
          <Icon name="alert" size={24} />
        </span>
        <h1 className="font-display text-[23px] text-ink">{t('checkout.failedTitle')}</h1>
        <p className="mt-1 text-[14px] leading-[1.6] text-ink2">
          {signatureOk ? t('checkout.failedBody') : t('checkout.failedUnverified')}
        </p>
        {reference ? <p className="mt-3 text-[12.5px] text-ink3">{t('checkout.reference', { ref: reference })}</p> : null}
        <div className="mt-5 flex flex-col gap-2.5">
          <LinkBtn title={t('common.retry')} href="/pricing" />
          <Link href="/account/help" className="text-center text-[13px] font-extrabold text-teal hover:underline">
            {t('account.help')}
          </Link>
        </div>
      </Card>
    </main>
  );
}
