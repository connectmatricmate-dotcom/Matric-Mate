'use client';

import { startTransition, useActionState, useCallback, useRef, useState } from 'react';
import { Btn, ErrorBanner, SubmitButton } from '@/components/ui/controls';
import { Confirm } from '@/components/ui/sheet';
import { deletePayoutAction, recordPayoutAction, setTeacherActiveAction, type AdminState } from '@/app/(admin)/actions';
import { Note, rupees } from '@/components/admin/bits';

/** Whole rupees, above zero, the same rule as the Payout schema in actions.ts. */
const AMOUNT = /^\d{1,8}$/;

/**
 * Recording a payment to a teacher.
 *
 * The amount is prefilled with what is outstanding, because that is what gets
 * paid nine times out of ten, and left editable because the tenth time it is a
 * part payment. Nothing here moves money: it is a note that money moved, so
 * both sides read the same number instead of comparing WhatsApp messages.
 *
 * It asks before recording, with the amount and the teacher's name in the
 * question, and says so when the amount is more than they are owed: the row
 * lands on the teacher's own dashboard the moment it is saved, so a typo is
 * seen by the one person it should not surprise. A payout recorded by mistake
 * can be deleted on the day (see DeletePayout).
 */
export function RecordPayout({ affiliateId, outstanding, teacherName }: { affiliateId: string; outstanding: number; teacherName: string }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(recordPayoutAction, {});
  const form = useRef<HTMLFormElement>(null);
  const [amount, setAmount] = useState(outstanding > 0 ? String(outstanding) : '');
  const [note, setNote] = useState('');
  const [asking, setAsking] = useState(false);
  const close = useCallback(() => setAsking(false), []);

  // A saved payout clears the form, so a second press cannot record it twice.
  // Adjusted during render, not in an effect.
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state.ok) {
      setAmount('');
      setNote('');
    }
  }

  const value = AMOUNT.test(amount.trim()) ? Number(amount.trim()) : 0;
  const valid = value > 0 && value <= 10_000_000;
  const over = valid && value > Math.max(0, outstanding);
  const first = teacherName.split(' ')[0] || teacherName;

  return (
    <form ref={form} action={action} className="rounded-[16px] border border-line bg-card px-4 py-4">
      <h2 className="font-display text-[17px] text-ink">Record a payout</h2>
      <p className="mt-0.5 text-[12.5px] text-ink2">
        After you have actually sent the money. It appears on {first}’s dashboard straight away.
      </p>

      {state.error ? (
        <div className="mt-3">
          <ErrorBanner message={state.error} />
        </div>
      ) : null}
      {state.ok ? (
        <div className="mt-3" role="status">
          <Note tone="green">{state.ok}</Note>
        </div>
      ) : null}

      <input type="hidden" name="affiliateId" value={affiliateId} />
      <div className="mt-3.5 grid gap-3 sm:grid-cols-[160px_1fr_auto] sm:items-end">
        <label className="block">
          <span className="mb-1 block text-[12.5px] font-extrabold text-ink2">Amount</span>
          <span className="field-shell flex items-center gap-1.5 rounded-[12px] border-[1.5px] border-line bg-card px-3.5 py-2.5 transition-[border-color,box-shadow] duration-200">
            <span className="text-[13px] font-extrabold text-ink3">Rs</span>
            <input
              name="amount"
              type="text"
              inputMode="numeric"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
              aria-invalid={amount !== '' && !valid}
              // 16px on a phone, where iOS Safari zooms into anything smaller.
              className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink3 md:text-[14px]"
              placeholder="0"
            />
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] font-extrabold text-ink2">Note</span>
          <span className="field-shell flex rounded-[12px] border-[1.5px] border-line bg-card px-3.5 py-2.5 transition-[border-color,box-shadow] duration-200">
            <input
              name="note"
              type="text"
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="JazzCash, 19 Aug"
              className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink3 md:text-[14px]"
            />
          </span>
        </label>
        <Btn title={pending ? 'Saving…' : 'Record'} loading={pending} disabled={!valid} onClick={() => setAsking(true)} />
      </div>

      <p className="mt-2.5 text-[12px] text-ink2">
        {outstanding > 0 ? `Outstanding right now: ${rupees(outstanding)}.` : `${first} is owed nothing right now.`}
      </p>

      <Confirm
        open={asking}
        onClose={close}
        tone={over ? 'orange' : 'primary'}
        title={`Record ${rupees(value)} paid to ${teacherName}?`}
        body={
          <div className="flex flex-col gap-2 text-[13.5px] leading-[1.6] text-ink2">
            {over ? (
              <p className="rounded-[12px] border border-orange bg-orangetint px-3 py-2 font-extrabold text-orangedark">
                That is {rupees(value - Math.max(0, outstanding))} more than they are owed right now ({rupees(Math.max(0, outstanding))}).
                It will show as paid ahead.
              </p>
            ) : null}
            <p>Only once the money has actually been sent. It shows on {first}’s dashboard straight away.</p>
          </div>
        }
        confirmLabel={`Record ${rupees(value)}`}
        cancelLabel="Not yet"
        onConfirm={() => {
          setAsking(false);
          form.current?.requestSubmit();
        }}
      />
    </form>
  );
}

/**
 * Take back a payout recorded by mistake, on the day it was recorded. The
 * server checks the day again, so a page left open overnight cannot delete an
 * older one.
 */
export function DeletePayout({ payoutId, affiliateId, amount, day, teacherName }: { payoutId: string; affiliateId: string; amount: number; day: string; teacherName: string }) {
  const [state, dispatch, pending] = useActionState<AdminState, FormData>(deletePayoutAction, {});
  const [asking, setAsking] = useState(false);
  const close = useCallback(() => setAsking(false), []);
  return (
    <span className="inline-flex flex-col items-start gap-1 md:items-end">
      <button
        type="button"
        disabled={pending}
        onClick={() => setAsking(true)}
        className="inline-flex h-11 shrink-0 cursor-pointer items-center rounded-full border border-line bg-card px-3.5 text-[12.5px] font-extrabold text-ink2 transition-colors duration-200 hover:border-red hover:text-red disabled:cursor-not-allowed disabled:opacity-60 md:h-10"
      >
        {pending ? 'Deleting…' : 'Delete'}
      </button>
      {state.error ? <span role="alert" className="max-w-[220px] text-[12px] font-extrabold text-red">{state.error}</span> : null}
      <Confirm
        open={asking}
        onClose={close}
        title={`Delete the payout of ${rupees(amount)}?`}
        body={`Recorded on ${day}. Delete it only if it was recorded by mistake. It comes off ${teacherName}’s dashboard straight away, and what they are owed goes back up by ${rupees(amount)}.`}
        confirmLabel="Delete payout"
        cancelLabel="Keep it"
        onConfirm={() => {
          setAsking(false);
          const form = new FormData();
          form.set('payoutId', payoutId);
          form.set('affiliateId', affiliateId);
          startTransition(() => dispatch(form));
        }}
      />
    </span>
  );
}

/** Suspend or restore a teacher's link. Their students and earnings are
 *  untouched either way; only new attribution stops. */
export function ToggleActive({ affiliateId, active }: { affiliateId: string; active: boolean }) {
  const [state, action] = useActionState<AdminState, FormData>(setTeacherActiveAction, {});
  return (
    // Wraps, so on a phone the status line drops under the button instead of
    // being squeezed into a tall column beside it.
    <form action={action} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <input type="hidden" name="affiliateId" value={affiliateId} />
      <input type="hidden" name="active" value={active ? 'false' : 'true'} />
      <SubmitButton
        title={active ? 'Switch the link off' : 'Switch the link back on'}
        pendingTitle="Saving…"
        variant="line"
        // A suspension is reversible and takes nothing away, so it does not get
        // a confirmation dialog. Deleting a teacher would; nothing here does.
      />
      {state.error ? <span role="alert" className="text-[12.5px] text-red">{state.error}</span> : null}
      {state.ok ? <span role="status" className="text-[12.5px] text-green">{state.ok}</span> : null}
    </form>
  );
}
