'use client';

/**
 * Mock Safepay checkout. `api.pay` stands in for the hosted payment page; when
 * the real integration lands (M4) this component keeps its shape and the
 * redirect happens instead of the fake await.
 *
 * This screen exists on the web only, the Android app may not show a price,
 * let alone take one. See packages/core/src/billing.ts.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@matricmate/core';
import { Btn, ErrorBanner, Field } from '@/components/ui/controls';
import { Card, Icon, LinkBtn, Pill } from '@/components/ui/primitives';
import { useApp, useT } from '@/lib/store';
import { INCLUDED, PAYMENT_METHODS, type Plan, rupees } from '@/lib/plans';
import { isFormValid, validateCardNumber, validateCvc, validateExpiry, validateMobile, validateName } from '@/lib/validation';

type Method = (typeof PAYMENT_METHODS)[number]['id'];

const TRIAL_DAYS = 3;

export function CheckoutForm({ plan }: { plan: Plan }) {
  const { state, actions, hydrated } = useApp();
  const t = useT();
  const router = useRouter();

  const [method, setMethod] = useState<Method>('jazzcash');
  const [mobile, setMobile] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ ref: string; validTill: number } | null>(null);

  const isCard = method === 'card';
  const errors = isCard
    ? [validateName(cardName), validateCardNumber(cardNumber), validateExpiry(expiry), validateCvc(cvc)]
    : [validateMobile(mobile)];
  const canSubmit = isFormValid(...errors);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.pay({ method, amount: plan.price });
      const validTill = Date.now() + plan.months * 30 * 864e5;
      actions.subscribePremium({ ref: res.ref, validTill });
      setDone({ ref: res.ref, validTill });
    } catch {
      setError('The payment didn’t go through. Nothing was charged. Try again, or use another method.');
    } finally {
      setBusy(false);
    }
  }

  /* ---------------------------------------------------------------- states */

  if (hydrated && !state.user) {
    return (
      <main className="mx-auto max-w-[460px] px-5 py-16">
        <Card>
          <h1 className="font-display text-[23px] text-ink">One step first</h1>
          <p className="mt-1 text-[14px] leading-[1.6] text-ink2">
            Premium attaches to your account, so create one, or log in, and we’ll bring you straight back here.
          </p>
          <div className="mt-5 flex flex-col gap-2.5">
            <LinkBtn title="Create an account" href="/signup" />
            <LinkBtn title="I already have one" href="/login" variant="line" />
          </div>
        </Card>
      </main>
    );
  }

  if (done) {
    return (
      <main className="mx-auto max-w-[460px] px-5 py-16">
        <Card className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-greentint text-green">
            <Icon name="check" size={28} strokeWidth={2.6} />
          </span>
          <h1 className="mt-3 font-display text-[24px] text-ink">Premium is on</h1>
          <p className="mt-1 text-[14px] leading-[1.6] text-ink2">
            Your {plan.name.toLowerCase()} plan runs until{' '}
            {new Date(done.validTill).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}. Every
            chapter is unlocked on this website and in the Android app.
          </p>
          <p className="mt-3 text-[12.5px] text-ink3">Receipt {done.ref}</p>
          <div className="mt-5 flex flex-col gap-2.5">
            <Btn title="Start studying" onClick={() => router.push('/dashboard')} />
            <LinkBtn title={t('account.paymentHistory')} href="/account/payments" variant="ghost" />
          </div>
        </Card>
      </main>
    );
  }

  /* ----------------------------------------------------------------- form */

  return (
    <main className="mx-auto grid max-w-[980px] gap-6 px-5 py-10 md:grid-cols-[1fr_360px] md:py-14">
      <div className="md:order-2">
        <Card flat className="md:sticky md:top-6">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink2">Your plan</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-[24px] text-ink">Premium · {plan.name}</span>
            {plan.saving ? <Pill tone="green">{plan.saving}</Pill> : null}
          </div>

          <dl className="mt-4 flex flex-col gap-2 text-[14px]">
            <div className="flex justify-between">
              <dt className="text-ink2">Plan total</dt>
              <dd className="font-extrabold text-ink">{rupees(plan.price)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink2">Works out to</dt>
              <dd className="text-ink2">{rupees(plan.perMonth)} / month</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2">
              <dt className="font-extrabold text-ink">Due today</dt>
              <dd className="font-display text-[19px] text-green">Rs 0</dd>
            </div>
          </dl>

          <p className="mt-3 text-[12.5px] leading-[1.6] text-ink2">
            {TRIAL_DAYS} days free. We message you two days before the trial ends. Nothing is charged until you say so.
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
            Change plan
          </Link>
        </Card>
      </div>

      <div className="md:order-1">
        <h1 className="font-display text-[27px] text-ink">How would you like to pay?</h1>
        <p className="mt-1 text-[14px] text-ink2">Saved for when the trial ends. Nothing leaves your account today.</p>

        {error ? (
          <div className="mt-4">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          </div>
        ) : null}

        <fieldset className="mt-5">
          <legend className="sr-only">Payment method</legend>
          <div className="flex flex-col gap-2.5">
            {PAYMENT_METHODS.map((m) => {
              const on = m.id === method;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setMethod(m.id);
                    setTouched(false);
                  }}
                  className={`flex min-h-14 items-center gap-3 rounded-[15px] border-[1.5px] px-4 py-3 text-left transition-colors duration-200 ${
                    on ? 'border-teal bg-tealtint' : 'border-line bg-card hover:border-tealtint2'
                  }`}
                >
                  <span className="text-[20px]">{m.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-extrabold text-ink">{m.label}</span>
                    <span className="block text-[12.5px] text-ink2">{m.hint}</span>
                  </span>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      on ? 'border-teal bg-teal text-white' : 'border-[#CBD8D3]'
                    }`}
                  >
                    {on ? <Icon name="check" size={12} strokeWidth={3.2} /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <form onSubmit={submit} noValidate className="mt-6">
          {isCard ? (
            <>
              <Field
                label="Name on card"
                value={cardName}
                onChange={setCardName}
                placeholder="Ahmed Raza"
                icon="user"
                autoComplete="cc-name"
                required
                error={touched ? (validateName(cardName) ?? undefined) : undefined}
              />
              <Field
                label="Card number"
                value={cardNumber}
                onChange={setCardNumber}
                placeholder="4242 4242 4242 4242"
                icon="card"
                autoComplete="cc-number"
                required
                error={touched ? (validateCardNumber(cardNumber) ?? undefined) : undefined}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Expiry"
                  value={expiry}
                  onChange={setExpiry}
                  placeholder="09/28"
                  icon="calendar"
                  autoComplete="cc-exp"
                  required
                  error={touched ? (validateExpiry(expiry) ?? undefined) : undefined}
                />
                <Field
                  label="CVC"
                  value={cvc}
                  onChange={setCvc}
                  placeholder="123"
                  icon="key"
                  autoComplete="cc-csc"
                  required
                  error={touched ? (validateCvc(cvc) ?? undefined) : undefined}
                />
              </div>
            </>
          ) : (
            <Field
              label={`${method === 'jazzcash' ? 'JazzCash' : 'EasyPaisa'} mobile number`}
              value={mobile}
              onChange={setMobile}
              placeholder="03001234567"
              icon="phone"
              type="tel"
              autoComplete="tel"
              required
              hint="You’ll get a confirmation prompt on this number when the trial ends."
              error={touched ? (validateMobile(mobile) ?? undefined) : undefined}
            />
          )}

          <Btn
            title={`Start ${TRIAL_DAYS} days free`}
            type="submit"
            variant="orange"
            loading={busy}
            disabled={!canSubmit}
            className="mt-2 w-full"
          />

          <p className="mt-3 text-[12.5px] leading-[1.6] text-ink2">
            By continuing you agree to the{' '}
            <Link href="/terms" className="font-extrabold text-teal hover:underline">
              Terms and Privacy Policy
            </Link>
            . Prototype build. No real payment is taken and no card details are stored.
          </p>
        </form>
      </div>
    </main>
  );
}
