'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { IconName } from '@matricmate/core';
import { Btn } from '@/components/ui/controls';
import { Sheet } from '@/components/ui/sheet';
import { ManualActivation } from '@/components/commerce/ManualActivation';
import { ManualPremium } from '@/components/commerce/ManualPremium';
import { formatDate } from '@matricmate/core';
import { THE_PLAN, rupees, type Plan } from '@/lib/plans';
import { startCheckout } from '@/lib/start-checkout';
import { useLang, useT } from '@/lib/store';

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
  full,
  plan = THE_PLAN,
}: {
  label?: string;
  variant?: 'primary' | 'orange' | 'line' | 'ghost';
  sm?: boolean;
  icon?: IconName | null;
  className?: string;
  /** Off for tight spots where the price is already on screen beside it. */
  withPrice?: boolean;
  /**
   * Fill the column on a phone, content width from sm up. `className` styles
   * the wrapper, which also holds the error line, so it cannot widen the
   * button itself.
   */
  full?: boolean;
  /** Which plan it buys. Premium unless the screen offers a choice. */
  plan?: Plan;
}) {
  const t = useT();
  const { lang } = useLang();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** No gateway live: the button explains how to get the plan instead. */
  const [manual, setManual] = useState(false);

  const title = label ?? t('account.upgrade');

  async function go() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const started = await startCheckout(plan.id);
      if (started.ok) return;
      if (started.error === 'manual_activation') {
        setManual(true);
        setBusy(false);
        return;
      }
      if (started.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/checkout?plan=${plan.id}`)}`);
        return;
      }
      // Basic while Premium is running: said plainly, with the date it ends.
      if (started.error === 'premium_running') {
        throw new Error(
          t('plans.premiumRunning', {
            date: started.validTill ? formatDate(started.validTill, lang, { day: 'numeric', month: 'long' }) : '',
          }),
        );
      }
      throw new Error(started.error ?? t('checkout.startFailed'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('checkout.startFailed'));
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <Btn
        title={withPrice ? `${title} · ${rupees(plan.price)}` : title}
        variant={variant}
        sm={sm}
        icon={icon ?? undefined}
        loading={busy}
        onClick={go}
        className={full ? 'w-full sm:w-auto' : ''}
      />
      {error ? (
        <p role="alert" className="mt-2 text-[12.5px] font-extrabold text-red">
          {error}
        </p>
      ) : null}
      <Sheet open={manual} onClose={() => setManual(false)} title={title}>
        {/* Premium is asked for and paid by hand; Basic is still arranged with the team. */}
        {plan.ai ? <ManualPremium bare /> : <ManualActivation plan={plan} />}
      </Sheet>
    </div>
  );
}
