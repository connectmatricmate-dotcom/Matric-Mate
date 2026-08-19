'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/controls';
import { grantPremiumAction, type AdminState } from '@/app/(admin)/actions';
import { Note } from '@/components/admin/bits';

/**
 * Give a student Premium for money taken outside the app.
 *
 * Until the gateway can complete a payment, this is how anybody buys: a
 * transfer or cash, then this form. It records the amount as a real payment
 * rather than only opening the account, so the overview's revenue and the
 * referring teacher's commission both count it.
 *
 * Uncontrolled inputs, as with the teacher form: a server action re-renders
 * the same form element, so the browser keeps what was typed on a failed
 * submit without four fields of React state to do it.
 */
export function GrantPremium({ plans, defaultPrice }: { plans: { id: string; name: string }[]; defaultPrice: number }) {
  const [state, action] = useActionState<AdminState, FormData>(grantPremiumAction, {});

  return (
    <form action={action} className="flex flex-col gap-3.5">
      <p className="text-[13.5px] leading-[1.6] text-ink2">
        For a student who paid by transfer, wallet or cash. They must have signed up first. The amount is recorded
        against their account, so it counts towards revenue and towards their teacher’s commission.
      </p>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-extrabold text-ink2">Student’s email</span>
          <input
            name="email"
            type="email"
            required
            placeholder="student@example.com"
            autoComplete="off"
            className="h-11 rounded-[12px] border border-line bg-card px-3.5 text-[14.5px] text-ink outline-none placeholder:text-ink3 focus-visible:border-teal"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-extrabold text-ink2">Plan</span>
          <select
            name="planId"
            defaultValue={plans[0]?.id}
            className="h-11 cursor-pointer rounded-[12px] border border-line bg-card px-3.5 text-[14.5px] text-ink outline-none focus-visible:border-teal"
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-extrabold text-ink2">Amount received (Rs)</span>
          <input
            name="amount"
            type="number"
            min={0}
            step={1}
            defaultValue={defaultPrice}
            className="h-11 rounded-[12px] border border-line bg-card px-3.5 text-[14.5px] text-ink outline-none focus-visible:border-teal"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-extrabold text-ink2">Note (optional)</span>
          <input
            name="note"
            type="text"
            placeholder="Bank transfer, 19 Aug"
            autoComplete="off"
            className="h-11 rounded-[12px] border border-line bg-card px-3.5 text-[14.5px] text-ink outline-none placeholder:text-ink3 focus-visible:border-teal"
          />
        </label>
      </div>

      {state.error ? <Note tone="red">{state.error}</Note> : null}
      {state.ok ? <Note tone="green">{state.ok}</Note> : null}

      <div className="flex">
        <SubmitButton title="Give Premium" pendingTitle="Recording…" />
      </div>
    </form>
  );
}
