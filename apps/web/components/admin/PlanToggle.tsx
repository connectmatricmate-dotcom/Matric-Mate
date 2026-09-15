'use client';

import { startTransition, useActionState, useCallback, useState } from 'react';
import type { PlanTier } from '@matricmate/core';
import { grantPremiumAction, revokePremiumAction, type AdminState } from '@/app/(admin)/actions';
import { ErrorBanner } from '@/components/ui/controls';
import { Icon } from '@/components/ui/primitives';
import { Confirm } from '@/components/ui/sheet';
import { planById } from '@/lib/plans';

/**
 * The plan buttons on a student's row: give a plan, add a month, move up, or
 * take it away.
 *
 * Plans are switched on from here, by hand, for money taken outside the app
 * (no gateway is live). The buttons are the choices that make sense for where
 * the student is now:
 *
 *   no plan, or on the free trial   Give Premium · Give Basic
 *   on Basic                        Add a month · Upgrade to Premium · Revoke
 *   on Premium                      Add a month · Revoke
 *
 * "Add a month" is how a plan is renewed: it adds to the current end date,
 * where the only way to renew used to be revoke and give again, which lost
 * the days left and refunded the payment behind them.
 *
 * Every button asks first and every answer is said out loud. Each one writes
 * a payment that counts in the revenue and in a teacher's commission, one
 * slip away from the wrong row, and a press that changed a plan without a
 * word left Adnan pressing again to be sure. The answer is held here rather
 * than in a form per button, because the row redraws with new buttons the
 * moment the plan changes, and a message kept by the button it answered would
 * vanish with it.
 *
 * Still no date picker and no amount: every extra field is a decision to make
 * before the thing Adnan wants happens. A plan is a month at its price, and
 * moving from Basic to Premium carries the unused Basic days over at half,
 * the same rule as a payment (lib/payments.ts).
 */

type Op = 'give' | 'upgrade' | 'extend' | 'revoke';
type Ask = { op: Op; planId: 'monthly' | 'basic' };
type Sheet = { title: string; body: string; confirm: string; cancel: string };

// From the one price list (lib/plans), so a price change cannot leave this
// sheet quoting the old amount.
const PRICE = { monthly: planById('monthly').price, basic: planById('basic').price } as const;
const NAME = { monthly: 'Premium', basic: 'Basic' } as const;
const DAY_MS = 864e5;

const date = (ms: number) =>
  new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' });

const base =
  'inline-flex h-11 shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-full px-3 text-[12.5px] font-extrabold transition-[filter,background-color,color,border-color] duration-200 disabled:cursor-not-allowed disabled:opacity-60 max-md:min-w-[8.5rem] max-md:flex-1 md:h-10 md:min-w-[148px]';
const tones = {
  fill: 'bg-teal text-onbrand hover:brightness-110',
  line: 'border border-teal bg-card text-teal hover:bg-tealtint',
  quiet: 'border border-line bg-card text-ink2 hover:border-red hover:text-red',
} as const;

export function PlanToggle({
  userId,
  tier,
  name,
  validTill,
  inline,
}: {
  userId: string;
  tier: PlanTier | null;
  name?: string;
  /** The running plan's end date, for saying what "Add a month" and an upgrade change it to. */
  validTill?: string | null;
  /** In a card of its own (the student's page) rather than the end column of a table: a row of buttons from the start edge. */
  inline?: boolean;
}) {
  const who = name?.trim() || 'this student';
  const [state, dispatch, pending] = useActionState<AdminState, FormData>(
    (prev, form) => (form.get('op') === 'revoke' ? revokePremiumAction(prev, form) : grantPremiumAction(prev, form)),
    {},
  );
  const [ask, setAsk] = useState<(Ask & { sheet: Sheet }) | null>(null);
  // Stable, because the sheet re-runs its focus and scroll-lock effect
  // whenever its onClose changes.
  const close = useCallback(() => setAsk(null), []);

  const run = (a: Ask) => {
    setAsk(null);
    const form = new FormData();
    form.set('userId', userId);
    form.set('planId', a.planId);
    form.set('op', a.op);
    startTransition(() => dispatch(form));
  };

  // The dates in the question are worked out when the button is pressed, not
  // on every render.
  const open = (a: Ask) => {
    const end = validTill ? Date.parse(validTill) : NaN;
    const left = Number.isFinite(end) ? Math.max(0, end - Date.now()) : 0;
    setAsk({ ...a, sheet: copy(a, who, end, left) });
  };

  const button = (label: string, tone: keyof typeof tones, a: Ask) => (
    <button type="button" disabled={pending} onClick={() => open(a)} className={`${base} ${tones[tone]}`}>
      {label}
    </button>
  );

  const current = tier === 'premium' ? 'monthly' : 'basic';
  const buttons =
    tier === 'premium' || tier === 'basic' ? (
      <>
        {button('Add a month', 'fill', { op: 'extend', planId: current })}
        {tier === 'basic' ? button('Upgrade to Premium', 'line', { op: 'upgrade', planId: 'monthly' }) : null}
        {button('Revoke', 'quiet', { op: 'revoke', planId: current })}
      </>
    ) : (
      <>
        {button('Give Premium', 'fill', { op: 'give', planId: 'monthly' })}
        {button('Give Basic', 'line', { op: 'give', planId: 'basic' })}
      </>
    );

  const sheet = ask?.sheet;

  // Beside a table's other columns the buttons stack at the end edge; on a
  // phone card, or in a card of their own, they sit in a row that wraps.
  const atEnd = !inline;
  return (
    <div className={`flex flex-col gap-2 ${atEnd ? 'md:items-end' : 'items-start'}`}>
      <div className={`flex flex-wrap gap-2 ${atEnd ? 'md:flex-col md:items-end md:gap-1.5' : ''}`}>{buttons}</div>
      {pending ? (
        <span role="status" className="flex items-center gap-1.5 text-[12px] font-extrabold text-ink2">
          <Icon name="refresh" size={14} className="animate-spin" />
          Saving…
        </span>
      ) : state.error ? (
        <div className={atEnd ? 'md:max-w-[260px] md:text-start' : ''}>
          <ErrorBanner message={state.error} />
        </div>
      ) : state.ok ? (
        <p role="status" className={`flex items-start gap-1.5 text-[12.5px] font-extrabold text-green ${atEnd ? 'md:max-w-[260px] md:text-end' : ''}`}>
          <Icon name="check" size={15} strokeWidth={2.6} className="mt-px shrink-0" />
          <span>{state.ok}</span>
        </p>
      ) : null}

      <Confirm
        open={!!ask}
        onClose={close}
        title={sheet?.title ?? ''}
        body={sheet?.body ?? ''}
        confirmLabel={sheet?.confirm ?? ''}
        cancelLabel={sheet?.cancel ?? 'Cancel'}
        tone={ask?.op === 'revoke' ? 'danger' : 'primary'}
        onConfirm={() => ask && run(ask)}
      />
    </div>
  );
}

/** What each button is about to do, in the words Adnan will check before he says yes. */
function copy(a: Ask, who: string, end: number, left: number): Sheet {
  const plan = NAME[a.planId];
  const money = `Rs ${PRICE[a.planId].toLocaleString('en-PK')} is recorded as paid, so it counts in revenue and towards their teacher’s commission. Do this once they have paid you.`;
  switch (a.op) {
    case 'give':
      return {
        title: `Give ${who} ${plan}?`,
        body: `${plan === 'Premium' ? 'Everything, with the AI tutor' : 'Every chapter and practice set, without the AI'}, for a month: until ${date(Date.now() + 30 * DAY_MS)}. ${money}`,
        confirm: `Give ${plan}`,
        cancel: 'Not now',
      };
    case 'upgrade':
      return {
        title: `Move ${who} up to Premium?`,
        body: `Their unused Basic days carry over at half, so Premium runs until about ${date(Date.now() + left / 2 + 30 * DAY_MS)}. ${money}`,
        confirm: 'Upgrade to Premium',
        cancel: 'Keep Basic',
      };
    case 'extend':
      return {
        title: `Add a month of ${plan} for ${who}?`,
        body: `${Number.isFinite(end) ? `Their plan ends on ${date(end)}. With this month it ends on ${date(end + 30 * DAY_MS)}.` : 'The month is added to their plan.'} ${money}`,
        confirm: 'Add a month',
        cancel: 'Not now',
      };
    case 'revoke':
      return {
        title: `Revoke ${who}’s ${plan}?`,
        body: 'Their access stops straight away. If this plan was given from this page, its payment is marked refunded, so it leaves the revenue total and their teacher’s commission. Earlier payments, and anything paid through the gateway, stay as they are.',
        confirm: `Revoke ${plan}`,
        cancel: `Keep ${plan}`,
      };
  }
}
