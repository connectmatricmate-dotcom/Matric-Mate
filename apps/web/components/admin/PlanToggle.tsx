'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { grantPremiumAction, revokePremiumAction, type AdminState } from '@/app/(admin)/actions';

/**
 * One button per student: give Premium, or take it away.
 *
 * Deliberately without a date picker, an amount or a plan menu. Adnan is
 * standing in front of somebody who has just handed over money, and every
 * extra field is a decision he has to make before the thing he wants happens.
 * The plan is the only plan, and the price is the price.
 *
 * The label is the state. A row either says "Give Premium" or "Revoke", so
 * the table can be read down its right edge to see who is paying, without
 * cross-referencing a status column.
 */
function Button({ active }: { active: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`min-h-9 w-[104px] cursor-pointer rounded-full px-3 text-[12.5px] font-extrabold transition-[filter,background-color,color] duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
        active
          ? 'border border-line bg-card text-ink2 hover:border-red hover:text-red'
          : 'bg-teal text-onbrand hover:brightness-110'
      }`}
    >
      {pending ? '…' : active ? 'Revoke' : 'Give Premium'}
    </button>
  );
}

export function PlanToggle({ userId, active }: { userId: string; active: boolean }) {
  const [state, action] = useActionState<AdminState, FormData>(
    active ? revokePremiumAction : grantPremiumAction,
    {}
  );

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="userId" value={userId} />
      <Button active={active} />
      {state.error ? <span className="text-[11.5px] font-extrabold text-red">{state.error}</span> : null}
    </form>
  );
}
