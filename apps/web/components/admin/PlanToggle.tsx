'use client';

import { useActionState, useCallback, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { grantPremiumAction, revokePremiumAction, type AdminState } from '@/app/(admin)/actions';
import { Confirm } from '@/components/ui/sheet';

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
 *
 * Giving is one press. Revoking asks first: it cuts the student off on the
 * spot and marks a manual payment refunded, and the button sits in a long
 * column of identical buttons, one slip away from the wrong row.
 */
function Button({ active, onRevoke }: { active: boolean; onRevoke: () => void }) {
  const { pending } = useFormStatus();
  return (
    <button
      // Revoke only opens the confirmation; the confirmation submits.
      type={active ? 'button' : 'submit'}
      onClick={active ? onRevoke : undefined}
      disabled={pending}
      /* Fixed height and one line, both states. Sized to the longer label so
         the column does not jump width when a row flips, and nowrap because
         "Give Premium" wrapped into two lines inside a pill. 44px on touch,
         40px where there is a mouse. */
      className={`inline-flex h-11 w-[124px] shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-full px-3 text-[12.5px] font-extrabold transition-[filter,background-color,color] duration-200 disabled:cursor-not-allowed disabled:opacity-60 md:h-10 ${
        active
          ? 'border border-line bg-card text-ink2 hover:border-red hover:text-red'
          : 'bg-teal text-onbrand hover:brightness-110'
      }`}
    >
      {pending ? '…' : active ? 'Revoke' : 'Give Premium'}
    </button>
  );
}

export function PlanToggle({ userId, active, name }: { userId: string; active: boolean; name?: string }) {
  const [state, action] = useActionState<AdminState, FormData>(
    active ? revokePremiumAction : grantPremiumAction,
    {}
  );
  const form = useRef<HTMLFormElement>(null);
  const [asking, setAsking] = useState(false);
  // Stable, because the sheet re-runs its focus and scroll-lock effect
  // whenever its onClose changes.
  const close = useCallback(() => setAsking(false), []);

  return (
    <>
      <form ref={form} action={action} className="flex flex-col items-end gap-1">
        <input type="hidden" name="userId" value={userId} />
        <Button active={active} onRevoke={() => setAsking(true)} />
        {state.error ? <span className="text-[11.5px] font-extrabold text-red">{state.error}</span> : null}
      </form>
      <Confirm
        open={asking}
        onClose={close}
        title={`Revoke ${name?.trim() || 'this student'}’s Premium?`}
        body="Their access stops straight away. Premium given from this page is also marked refunded, so it leaves the revenue total and their teacher’s commission. A payment made through the gateway stays as it is."
        confirmLabel="Revoke Premium"
        cancelLabel="Keep Premium"
        onConfirm={() => {
          setAsking(false);
          form.current?.requestSubmit();
        }}
      />
    </>
  );
}
