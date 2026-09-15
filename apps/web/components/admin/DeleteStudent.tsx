'use client';

import { startTransition, useActionState, useCallback, useState } from 'react';
import { deleteStudentAction, type AdminState } from '@/app/(admin)/actions';
import { ErrorBanner } from '@/components/ui/controls';
import { Confirm } from '@/components/ui/sheet';

/**
 * The last panel on a student's page: delete the account for them, when they
 * have asked by email or on the phone and cannot sign in to do it themselves.
 * Asks first, naming the student, because nothing brings an account back.
 */
export function DeleteStudent({ userId, name }: { userId: string; name: string }) {
  const [asking, setAsking] = useState(false);
  const close = useCallback(() => setAsking(false), []);
  const [state, dispatch, pending] = useActionState<AdminState, FormData>(deleteStudentAction, {});

  const run = () => {
    setAsking(false);
    const form = new FormData();
    form.set('userId', userId);
    startTransition(() => dispatch(form));
  };

  return (
    <section className="mt-6 rounded-[16px] border border-line bg-card px-4 py-4">
      <h2 className="font-display text-[17px] text-ink">Delete this account</h2>
      <p className="mt-1.5 text-[13.5px] leading-[1.6] text-ink2">
        Only when {name} has asked you to. Their login, study history, AI chats and plan are deleted for good. Payments stay in your
        records with no name on them.
      </p>
      {state.error ? (
        <div className="mt-3">
          <ErrorBanner message={state.error} />
        </div>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={() => setAsking(true)}
        className="mt-4 inline-flex h-11 cursor-pointer items-center justify-center rounded-full border border-red bg-card px-5 text-[13px] font-extrabold text-red transition-colors duration-200 hover:bg-redtint disabled:cursor-not-allowed disabled:opacity-60 md:h-10"
      >
        {pending ? 'Deleting…' : 'Delete account'}
      </button>
      <Confirm
        open={asking}
        onClose={close}
        title={`Delete ${name}'s account?`}
        body="This cannot be undone. The student can sign up again later, as a new account with nothing on it."
        confirmLabel="Yes, delete it"
        cancelLabel="Keep it"
        onConfirm={run}
      />
    </section>
  );
}
