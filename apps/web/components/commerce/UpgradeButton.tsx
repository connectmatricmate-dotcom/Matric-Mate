'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { IconName } from '@matricmate/core';
import { Btn } from '@/components/ui/controls';
import { THE_PLAN, rupees } from '@/lib/plans';
import { useT } from '@/lib/store';

/**
 * Upgrade, in one press.
 *
 * There used to be four steps between wanting to pay and paying: dashboard,
 * pricing page, pick one of three lengths, checkout page, then Safepay. Every
 * one of those was a place to change your mind, and none of them told the
 * student anything the Safepay page does not.
 *
 * So this asks the server for a checkout session and sends the browser
 * straight there. The price is on the button rather than on a page before it,
 * because a student should never arrive at a payment screen unsure what they
 * are about to be charged.
 *
 * Signed out is handled by the API, which answers 401. Rather than showing an
 * error for something that is not a failure, we send them to log in and come
 * straight back to the same press.
 */
export function UpgradeButton({
  label,
  variant = 'primary',
  sm,
  icon = 'crown',
  className,
  withPrice = true,
}: {
  label?: string;
  variant?: 'primary' | 'orange' | 'line' | 'ghost';
  sm?: boolean;
  icon?: IconName | null;
  className?: string;
  /** Off for tight spots where the price is already on screen beside it. */
  withPrice?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = label ?? t('account.upgrade');

  async function go() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: THE_PLAN.id }),
      });
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent('/checkout')}`);
        return;
      }
      const body = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !body.url) throw new Error(body.error ?? t('checkout.startFailed'));
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : t('checkout.startFailed'));
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <Btn
        title={withPrice ? `${title} · ${rupees(THE_PLAN.price)}` : title}
        variant={variant}
        sm={sm}
        icon={icon ?? undefined}
        loading={busy}
        onClick={go}
      />
      {error ? (
        <p role="alert" className="mt-2 text-[12.5px] font-extrabold text-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}
