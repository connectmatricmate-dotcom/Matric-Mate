'use client';

/**
 * Checkout.
 *
 * With Safepay's hosted page configured, this screen does not ask for a card.
 * It cannot: the card or wallet is entered on Safepay's own domain, which is
 * the whole point. It keeps MatricMate out of PCI scope, and it is the honest
 * demo, because it is exactly what a student will see.
 *
 * With no keys it falls back to a mock confirmation, so the prototype still
 * runs on a laptop that has no secrets.
 *
 * Web only. The Android app may not show a price, let alone take one. See
 * packages/core/src/billing.ts.
 */
import Link from 'next/link';
import { useState } from 'react';
import { PayMark } from '@/components/commerce/PayMark';
import { Btn, ErrorBanner } from '@/components/ui/controls';
import { Card, Icon, LinkBtn, Pill } from '@/components/ui/primitives';
import { useT } from '@/lib/store';
import { INCLUDED, PAYMENT_METHODS, type Plan, rupees } from '@/lib/plans';


/**
 * Copy for each payment method lives in the i18n dictionaries; plans.ts keeps
 * only the ids and logos plus the English fallback the server pages render.
 */
const METHOD_COPY = {
  raast: { label: 'checkout.methodRaast', hint: 'checkout.methodRaastHint' },
  card: { label: 'checkout.methodCard', hint: 'checkout.methodCardHint' },
} as const;

export function CheckoutForm({
  plan,
  live,
  cancelled,
  accountEmail,
}: {
  plan: Plan;
  /** True when this deployment has Safepay keys. */
  live: boolean;
  cancelled?: boolean;
  /** The account Premium will be added to. Named on screen, see below. */
  accountEmail?: string | null;
}) {
  const t = useT();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    cancelled ? t('checkout.cancelledNote') : null
  );
  async function pay() {
    setBusy(true);
    setError(null);

    if (!live) {
      // No gateway on this deployment. Say so rather than faking a receipt:
      // entitlement is written by the webhook now, and a pretend one here would
      // disagree with the database the moment anything reloaded.
      setBusy(false);
      setError(t('checkout.notLive'));
      return;
    }

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: plan.id }),
      });
      const body = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !body.url) throw new Error(body.error ?? t('checkout.startFailed'));
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : t('checkout.startFailed'));
      setBusy(false);
    }
  }

  /**
   * Whether someone is signed in was decided on the server: /checkout is a
   * protected route, so proxy.ts has already turned strangers away, and the
   * page passed the session's email down as accountEmail. The old version
   * asked the localStorage store instead and showed a "log in first" gate
   * while the client's own Supabase round-trip was still in flight, which for
   * a signed-in student reads as being locked out of paying. Server truth
   * only; the client store is a cache, never a doorman.
   */
  if (accountEmail === null) {
    return (
      <main className="mx-auto max-w-[460px] px-5 py-16">
        <Card>
          <h1 className="font-display text-[23px] text-ink">{t('checkout.gateTitle')}</h1>
          <p className="mt-1 text-[14px] leading-[1.6] text-ink2">{t('checkout.gateBody')}</p>
          <div className="mt-5 flex flex-col gap-2.5">
            <LinkBtn title={t('checkout.gateSignUp')} href="/signup?next=/checkout" />
            <LinkBtn title={t('checkout.gateLogIn')} href="/login?next=/checkout" variant="line" />
          </div>
        </Card>
      </main>
    );
  }

  // These two sentences carry inline markup (a bold email, a linked "Terms"),
  // so the translated string is split on its placeholder and the JSX goes in
  // the gap. Word order stays free for the Urdu side this way.
  const accountNote = t('checkout.accountNote').split('{email}');
  const agreeLine = t('checkout.agreeTerms').split('{terms}');

  return (
    <main className="mx-auto grid max-w-[980px] gap-6 px-5 py-10 md:grid-cols-[1fr_360px] md:py-14">
      {/* order summary */}
      <div className="md:order-2">
        <Card flat className="md:sticky md:top-6">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink2">{t('checkout.yourPlan')}</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-2">
            <span className="font-display text-[24px] text-ink">{t('checkout.planTitle', { plan: plan.name })}</span>
            {plan.saving ? <Pill tone="green">{plan.saving}</Pill> : null}
          </div>

          <dl className="mt-4 flex flex-col gap-2 text-[14px]">
            <div className="flex justify-between">
              <dt className="text-ink2">{t('checkout.planTotal')}</dt>
              <dd className="font-extrabold text-ink">{rupees(plan.price)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink2">{t('checkout.worksOutTo')}</dt>
              <dd className="text-ink2">{t('checkout.perMonth', { price: rupees(plan.perMonth) })}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2">
              <dt className="font-extrabold text-ink">{t('checkout.dueToday')}</dt>
              <dd className="font-display text-[19px] text-green">{rupees(plan.price)}</dd>
            </div>
          </dl>

          <p className="mt-3 text-[12.5px] leading-[1.6] text-ink2">
            {live ? t('checkout.liveNote') : t('checkout.payNote')}
          </p>

          <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
            {INCLUDED.slice(0, 4).map((li) => (
              <li key={li} className="flex items-start gap-2.5 text-[13.5px] text-ink2">
                <Icon name="check" size={15} strokeWidth={2.6} className="mt-0.5 shrink-0 text-green" />
                {li}
              </li>
            ))}
          </ul>

          <Link href="/pricing" className="mt-4 inline-block text-[13px] font-extrabold text-teal hover:underline">
            {t('checkout.changePlan')}
          </Link>
        </Card>
      </div>

      {/* payment */}
      <div className="md:order-1">
        <h1 className="font-display text-[27px] text-ink">{t('checkout.title')}</h1>
        <p className="mt-1 text-[14px] leading-[1.6] text-ink2">
          {live ? t('checkout.subLive') : t('checkout.subPreview')}
        </p>

        {error ? (
          <div className="mt-4">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          </div>
        ) : null}

        <Card className="mt-5">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink2">{t('checkout.payWith')}</p>
          <ul className="mt-3 flex flex-col gap-2.5">
            {PAYMENT_METHODS.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <PayMark logo={m.logo} label={t(METHOD_COPY[m.id].label)} size={26} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-extrabold text-ink">{t(METHOD_COPY[m.id].label)}</span>
                  <span className="block text-[12.5px] text-ink2">{t(METHOD_COPY[m.id].hint)}</span>
                </span>
                <Icon name="check" size={16} strokeWidth={2.6} className="shrink-0 text-green" />
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-start gap-2 border-t border-line pt-3 text-[12.5px] leading-[1.6] text-ink2">
            <Icon name="lock" size={15} className="mt-0.5 shrink-0 text-teal" />
            {t('checkout.secureNote')}
          </p>
        </Card>

        {/*
          Which account gets Premium, said plainly and before they leave.

          Safepay's page asks for an email of its own and we cannot prefill it,
          so a student can pay under a different address than the one they
          signed in with. That address only decides where Safepay sends its
          receipt: Premium follows the payment we recorded against this account,
          not whatever gets typed on the next screen. Saying so here is cheaper
          than answering it in support afterwards.
        */}
        {accountEmail ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-tealtint px-3.5 py-3 text-[13px] leading-[1.6] text-ink2">
            <Icon name="user" size={15} className="mt-0.5 shrink-0 text-teal" />
            <span>
              {accountNote[0]}
              <strong className="text-ink">{accountEmail}</strong>
              {accountNote[1]}
            </span>
          </p>
        ) : null}

        <Btn
          title={
            live
              ? t('checkout.continueToSafepay', { price: rupees(plan.price) })
              : t('checkout.subscribeNow', { price: rupees(plan.price) })
          }
          onClick={pay}
          variant="orange"
          loading={busy}
          className="w-full"
        />

        <p className="mt-3 text-[12.5px] leading-[1.6] text-ink2">
          {agreeLine[0]}
          <Link href="/terms" className="font-extrabold text-teal hover:underline">
            {t('checkout.termsLink')}
          </Link>
          {agreeLine[1]} {live ? t('checkout.testNote') : t('checkout.previewNote')}
        </p>

        <p className="mt-4 text-[12.5px] text-ink3">
          {t('checkout.needHelp')}{' '}
          <Link href="/account/help" className="font-extrabold text-teal hover:underline">{t('account.help')}</Link>
        </p>
      </div>
    </main>
  );
}
