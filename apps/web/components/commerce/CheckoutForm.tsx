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
import { AI_QUOTA, daysLeft, formatDate, type StringKey } from '@matricmate/core';
import { useApp, useLang, useT } from '@/lib/store';
import { BASIC_PLAN, PAYMENT_METHODS, THE_PLAN, planName, rupees, type Plan } from '@/lib/plans';
import { startCheckout } from '@/lib/start-checkout';
import { ManualActivation } from '@/components/commerce/ManualActivation';

/** What each plan opens, from the shared strings so both languages agree. */
const PERKS: Record<'basic' | 'premium', StringKey[]> = {
  basic: ['plans.basicPerk1', 'plans.basicPerk2', 'plans.basicPerk3', 'plans.basicPerk4'],
  premium: ['plans.premiumPerk1', 'plans.premiumPerk2', 'plans.premiumPerk3', 'plans.premiumPerk4'],
};


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
  configured,
  online = true,
  cancelled,
  accountEmail,
}: {
  plan: Plan;
  /**
   * Whether a student can pay online here at all. Off while plans are switched
   * on by hand (see onlinePayments in lib/gateway): the page then says how to
   * get the chosen plan instead of offering a payment that goes nowhere.
   */
  online?: boolean;
  /** Keys are present, so a checkout can actually be started. */
  configured: boolean;
  /** True when this deployment has Safepay keys. */
  live: boolean;
  cancelled?: boolean;
  /** The account Premium will be added to. Named on screen, see below. */
  accountEmail?: string | null;
}) {
  const t = useT();
  const { lang } = useLang();
  const { derived } = useApp();
  /*
   * Which of the two plans, switchable here. It arrives from ?plan= (the
   * pricing page and the upgrade screen link straight to one), and the order
   * summary is where a student changes their mind without starting over.
   */
  const [chosen, setChosen] = useState<Plan>(plan.id === BASIC_PLAN.id ? BASIC_PLAN : THE_PLAN);
  const current = derived.access;
  /** Premium running and Basic picked: the server refuses it, so the page does first. */
  const blocked = !chosen.ai && current.tier === 'premium';
  /** Basic running and Premium picked: what the unused days become. See carriedOver in lib/payments. */
  const leftDays = current.tier === 'basic' ? daysLeft(current.validTill) : 0;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    cancelled ? t('checkout.cancelledNote') : null
  );
  async function pay() {
    setBusy(true);
    setError(null);

    if (!configured) {
      // No keys on this deployment, so there is no gateway to send anyone to.
      // Say so rather than faking a receipt: entitlement is written by the
      // webhook, and a pretend one here would disagree with the database the
      // moment anything reloaded.
      //
      // Sandbox is deliberately NOT a reason to stop. Sandbox exists so the
      // whole flow can be walked end to end, and refusing here meant the one
      // environment built for testing payments was the one that could not test
      // them. The banner above already says no real money moves.
      setBusy(false);
      setError(t('checkout.notLive'));
      return;
    }

    try {
      // Safepay answers with a URL and PayFast with a form; startCheckout goes to either.
      const started = await startCheckout(chosen.id);
      if (started.ok) return;
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
          {/* The two plans, as a pair of choices: the one picked is the order below. */}
          <div role="radiogroup" aria-label={t('checkout.yourPlan')} className="mt-2.5 grid grid-cols-2 gap-2">
            {[THE_PLAN, BASIC_PLAN].map((p) => {
              const on = chosen.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setChosen(p)}
                  className={`flex min-h-11 flex-col items-start rounded-[14px] border-[1.5px] px-3 py-2.5 text-start transition-colors duration-200 ${
                    on ? 'border-teal bg-tealtint' : 'border-line bg-card hover:border-teal'
                  }`}
                >
                  <span className="text-[14px] font-extrabold text-ink">{planName(p.id, lang)}</span>
                  <span className="latin text-[12.5px] text-ink2">{t('plans.perMonth', { price: rupees(p.perMonth) })}</span>
                  <span className={`mt-0.5 text-[11.5px] font-extrabold ${p.ai ? 'text-teal' : 'text-ink3'}`}>
                    {t(p.ai ? 'plans.premiumTag' : 'plans.basicTag')}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-2">
            <span className="font-display text-[24px] text-ink">{t('checkout.planTitle', { plan: planName(chosen.id, lang) })}</span>
            {chosen.saving ? <Pill tone="green">{chosen.saving}</Pill> : null}
          </div>
          {blocked ? (
            <p role="status" className="mt-2 rounded-xl bg-orangetint px-3 py-2 text-[12.5px] leading-[1.55] text-orangedark">
              {t('plans.premiumRunning', {
                date: current.validTill ? formatDate(current.validTill, lang, { day: 'numeric', month: 'long' }) : '',
              })}
            </p>
          ) : chosen.ai && leftDays > 0 ? (
            <p className="mt-2 rounded-xl bg-tealtint px-3 py-2 text-[12.5px] leading-[1.55] text-ink2">
              {t('plans.upgradeNote', { n: leftDays, m: Math.floor(leftDays / 2) })}
            </p>
          ) : null}

          <dl className="mt-4 flex flex-col gap-2 text-[14px]">
            <div className="flex justify-between">
              <dt className="text-ink2">{t('checkout.planTotal')}</dt>
              <dd className="font-extrabold text-ink">{rupees(chosen.price)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink2">{t('checkout.worksOutTo')}</dt>
              <dd className="text-ink2">{t('checkout.perMonth', { price: rupees(chosen.perMonth) })}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2">
              <dt className="font-extrabold text-ink">{t('checkout.dueToday')}</dt>
              <dd className="font-display text-[19px] text-green">{rupees(chosen.price)}</dd>
            </div>
          </dl>

          {online ? (
            <p className="mt-3 text-[12.5px] leading-[1.6] text-ink2">
              {live ? t('checkout.liveNote') : t('checkout.payNote')}
            </p>
          ) : null}

          <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
            {PERKS[chosen.ai ? 'premium' : 'basic'].map((key) => (
              <li key={key} className="flex items-start gap-2.5 text-[13.5px] text-ink2">
                <Icon name="check" size={15} strokeWidth={2.6} className="mt-0.5 shrink-0 text-green" />
                {t(key, { n: AI_QUOTA.premium })}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* payment */}
      <div className="md:order-1">
        <h1 className="font-display text-[27px] text-ink">{t('checkout.title')}</h1>
        {online ? (
          <p className="mt-1 text-[14px] leading-[1.6] text-ink2">
            {live ? t('checkout.subLive') : t('checkout.subPreview')}
          </p>
        ) : null}

        {error ? (
          <div className="mt-4">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          </div>
        ) : null}

        {!online ? (
          <div className="mt-5">
            <ManualActivation plan={chosen} />
          </div>
        ) : (
        <>
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
              ? t('checkout.continueToSafepay', { price: rupees(chosen.price) })
              : t('checkout.subscribeNow', { price: rupees(chosen.price) })
          }
          onClick={pay}
          variant="orange"
          loading={busy}
          disabled={blocked}
          className="w-full"
        />

        <p className="mt-3 text-[12.5px] leading-[1.6] text-ink2">
          {agreeLine[0]}
          <Link href="/terms" className="font-extrabold text-teal hover:underline">
            {t('checkout.termsLink')}
          </Link>
          {agreeLine[1]} {live ? t('checkout.testNote') : t('checkout.previewNote')}
        </p>
        </>
        )}

        <p className="mt-4 text-[12.5px] text-ink3">
          {t('checkout.needHelp')}{' '}
          <Link href="/account/help" className="font-extrabold text-teal hover:underline">{t('account.help')}</Link>
        </p>
      </div>
    </main>
  );
}
