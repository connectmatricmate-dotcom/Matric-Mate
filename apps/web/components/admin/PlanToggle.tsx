'use client';

import { useActionState, useCallback, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import type { PlanTier } from '@matricmate/core';
import { grantPremiumAction, revokePremiumAction, type AdminState } from '@/app/(admin)/actions';
import { Confirm } from '@/components/ui/sheet';

/**
 * The plan buttons on a student's row: give a plan, move up, or take it away.
 *
 * Plans are switched on from here, by hand, for money taken outside the app
 * (no gateway is live). Since 14 Sep 2026 there are two plans, so the buttons
 * are the choices that make sense for where the student is now:
 *
 *   no plan, or on the free trial   Give Premium · Give Basic
 *   on Basic                        Upgrade to Premium · Revoke
 *   on Premium                      Revoke
 *
 * Still no date picker and no amount: every extra field is a decision to make
 * before the thing Adnan wants happens. A plan is a month at its price, and
 * moving from Basic to Premium carries the unused Basic days over at half,
 * the same rule as a payment (lib/payments.ts).
 *
 * Giving is one press. Revoking asks first: it cuts the student off on the
 * spot and marks a manual payment refunded, one slip away from the wrong row.
 */
const base =
  'inline-flex h-11 shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-full px-3 text-[12.5px] font-extrabold transition-[filter,background-color,color] duration-200 disabled:cursor-not-allowed disabled:opacity-60 md:h-10';

function Submit({ label, tone }: { label: string; tone: 'fill' | 'line' }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${base} w-[132px] ${tone === 'fill' ? 'bg-teal text-onbrand hover:brightness-110' : 'border border-teal bg-card text-teal hover:bg-tealtint'}`}
    >
      {pending ? '…' : label}
    </button>
  );
}

/** One plan, one form: the plan travels as a hidden field, not a submitter value. */
function GiveForm({ userId, planId, label, tone }: { userId: string; planId: 'monthly' | 'basic'; label: string; tone: 'fill' | 'line' }) {
  const [state, action] = useActionState<AdminState, FormData>(grantPremiumAction, {});
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="planId" value={planId} />
      <Submit label={label} tone={tone} />
      {state.error ? <span className="max-w-[160px] text-end text-[11.5px] font-extrabold text-red">{state.error}</span> : null}
    </form>
  );
}

function RevokeForm({ userId, name, planLabel }: { userId: string; name?: string; planLabel: string }) {
  const [state, action] = useActionState<AdminState, FormData>(revokePremiumAction, {});
  const form = useRef<HTMLFormElement>(null);
  const [asking, setAsking] = useState(false);
  // Stable, because the sheet re-runs its focus and scroll-lock effect
  // whenever its onClose changes.
  const close = useCallback(() => setAsking(false), []);
  return (
    <>
      <form ref={form} action={action} className="flex flex-col items-end gap-1">
        <input type="hidden" name="userId" value={userId} />
        <button
          type="button"
          onClick={() => setAsking(true)}
          className={`${base} w-[132px] border border-line bg-card text-ink2 hover:border-red hover:text-red`}
        >
          Revoke
        </button>
        {state.error ? <span className="max-w-[160px] text-end text-[11.5px] font-extrabold text-red">{state.error}</span> : null}
      </form>
      <Confirm
        open={asking}
        onClose={close}
        title={`Revoke ${name?.trim() || 'this student'}’s ${planLabel}?`}
        body="Their access stops straight away. A plan given from this page is also marked refunded, so it leaves the revenue total and their teacher’s commission. A payment made through the gateway stays as it is."
        confirmLabel={`Revoke ${planLabel}`}
        cancelLabel={`Keep ${planLabel}`}
        onConfirm={() => {
          setAsking(false);
          form.current?.requestSubmit();
        }}
      />
    </>
  );
}

export function PlanToggle({ userId, tier, name }: { userId: string; tier: PlanTier | null; name?: string }) {
  if (tier === 'premium') {
    return <RevokeForm userId={userId} name={name} planLabel="Premium" />;
  }
  if (tier === 'basic') {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <GiveForm userId={userId} planId="monthly" label="Upgrade to Premium" tone="fill" />
        <RevokeForm userId={userId} name={name} planLabel="Basic" />
      </div>
    );
  }
  // No plan, or a free trial the student now wants to turn into a real one.
  return (
    <div className="flex flex-col items-end gap-1.5">
      <GiveForm userId={userId} planId="monthly" label="Give Premium" tone="fill" />
      <GiveForm userId={userId} planId="basic" label="Give Basic" tone="line" />
    </div>
  );
}
