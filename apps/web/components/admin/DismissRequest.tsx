'use client';

import { startTransition, useActionState, useCallback, useState } from 'react';
import { dismissPlanRequestAction, type AdminState } from '@/app/(admin)/actions';
import { Confirm } from '@/components/ui/sheet';

/**
 * Sets a Premium request aside without giving the plan (dismissPlanRequestAction).
 * Asks first: a dismissed request leaves the list, and a student who did pay
 * would then be waiting on nobody.
 */
export function DismissRequest({ id, name }: { id: string; name: string }) {
  const [state, dispatch, pending] = useActionState<AdminState, FormData>(dismissPlanRequestAction, {});
  const [asking, setAsking] = useState(false);
  const close = useCallback(() => setAsking(false), []);
  return (
    <span className="inline-flex flex-col items-start gap-1 md:items-end">
      <button
        type="button"
        disabled={pending}
        onClick={() => setAsking(true)}
        className="inline-flex h-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-card px-3.5 text-[12.5px] font-extrabold text-ink2 transition-colors duration-200 hover:border-red hover:text-red disabled:cursor-not-allowed disabled:opacity-60 max-md:w-full md:h-10"
      >
        {pending ? 'Saving…' : 'Dismiss'}
      </button>
      {state.error ? (
        <span role="alert" className="max-w-[240px] text-[12px] text-red">
          {state.error}
        </span>
      ) : null}
      <Confirm
        open={asking}
        onClose={close}
        title="Dismiss this request?"
        body={`${name}’s request leaves this list and no plan is given. Only do this if they are not paying; giving Premium closes a request by itself.`}
        confirmLabel="Dismiss"
        cancelLabel="Keep it"
        onConfirm={() => {
          setAsking(false);
          const form = new FormData();
          form.set('requestId', id);
          startTransition(() => dispatch(form));
        }}
      />
    </span>
  );
}
