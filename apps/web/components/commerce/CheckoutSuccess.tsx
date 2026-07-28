'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { Btn } from '@/components/ui/controls';
import { Card, Icon, LinkBtn } from '@/components/ui/primitives';
import { useNow } from '@/lib/now';
import { planById } from '@/lib/plans';
import { useApp, useT } from '@/lib/store';

/**
 * The page Safepay sends the payer back to.
 *
 * `verified` means the HMAC on the redirect checked out, so Safepay really sent
 * this browser here. It does **not** mean money settled: that is what the
 * webhook will confirm once there is a database to write it to. Until then the
 * Premium flag set here lives in this browser only, and the note at the bottom
 * says as much rather than implying a receipt that does not exist yet.
 */
export function CheckoutSuccess({
  verified,
  reference,
  orderId,
  tracker,
}: {
  verified: boolean;
  reference?: string;
  orderId?: string;
  tracker?: string;
}) {
  const { actions, hydrated } = useApp();
  const t = useT();
  const router = useRouter();
  const now = useNow();
  const granted = useRef(false);

  // The plan is encoded in the order id we generated: MM-<plan>-<stamp>.
  const plan = planById(orderId?.split('-')[1] ?? 'quarter');

  useEffect(() => {
    if (!verified || !hydrated || granted.current) return;
    granted.current = true;
    actions.subscribePremium({
      ref: reference || tracker?.slice(0, 18) || 'SP-SANDBOX',
      validTill: (now || Date.now()) + plan.months * 30 * 864e5,
      plan: plan.id,
    });
  }, [verified, hydrated, reference, tracker, plan.months, plan.id, actions, now]);

  if (!verified) {
    return (
      <main className="mx-auto max-w-[460px] px-5 py-16">
        <Card>
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-[16px] bg-redtint text-red">
            <Icon name="alert" size={24} />
          </span>
          <h1 className="font-display text-[23px] text-ink">We could not confirm that payment</h1>
          <p className="mt-1 text-[14px] leading-[1.6] text-ink2">
            Nothing has been charged that we can see. If money did leave your account, send us the reference and we
            will sort it out the same day.
          </p>
          <div className="mt-5 flex flex-col gap-2.5">
            <LinkBtn title="Try again" href="/pricing" />
            <LinkBtn title={t('account.help')} href="/account/help" variant="line" />
          </div>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[460px] px-5 py-16">
      <Card className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-greentint text-green">
          <Icon name="check" size={28} strokeWidth={2.6} />
        </span>
        <h1 className="mt-3 font-display text-[24px] text-ink">Premium is on</h1>
        <p className="mt-1 text-[14px] leading-[1.6] text-ink2">
          Your {plan.name.toLowerCase()} plan runs until{' '}
          {new Date(now + plan.months * 30 * 864e5).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          . Every chapter is unlocked on this website and in the Android app.
        </p>

        {reference ? <p className="mt-3 text-[12.5px] text-ink3">Receipt {reference}</p> : null}

        <div className="mt-5 flex flex-col gap-2.5">
          <Btn title="Start studying" onClick={() => router.push('/dashboard')} />
          <LinkBtn title={t('account.paymentHistory')} href="/account/payments" variant="ghost" />
        </div>
      </Card>

      <p className="mt-4 text-center text-[12px] leading-[1.6] text-ink3">
        Safepay sandbox. No money moved, and this unlock lives in this browser only until accounts are on the server.
      </p>
    </main>
  );
}
