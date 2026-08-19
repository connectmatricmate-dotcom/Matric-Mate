'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/ui/controls';
import { recordPayoutAction, setTeacherActiveAction, type AdminState } from '@/app/(admin)/actions';
import { Note, rupees } from '@/components/admin/bits';

/**
 * Recording a payment to a teacher.
 *
 * The amount is prefilled with what is outstanding, because that is what gets
 * paid nine times out of ten, and left editable because the tenth time it is a
 * part payment. Nothing here moves money: it is a note that money moved, so
 * both sides read the same number instead of comparing WhatsApp messages.
 */
export function RecordPayout({ affiliateId, outstanding }: { affiliateId: string; outstanding: number }) {
  const [state, action] = useActionState<AdminState, FormData>(recordPayoutAction, {});

  return (
    <form action={action} className="rounded-[16px] border border-line bg-card px-4 py-4">
      <h2 className="font-display text-[17px] text-ink">Record a payout</h2>
      <p className="mt-0.5 text-[12.5px] text-ink2">
        After you have actually sent the money. It appears on their dashboard straight away.
      </p>

      {state.error ? (
        <div className="mt-3" role="alert">
          <Note tone="red">{state.error}</Note>
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
          <span className="flex items-center gap-1.5 rounded-[12px] border-[1.5px] border-line bg-paper px-3.5 py-2.5 focus-within:border-teal">
            <span className="text-[13px] font-extrabold text-ink3">Rs</span>
            <input
              name="amount"
              type="number"
              min="1"
              step="1"
              required
              defaultValue={outstanding > 0 ? outstanding : undefined}
              className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink3"
              placeholder="0"
            />
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-[12.5px] font-extrabold text-ink2">Note</span>
          <span className="flex rounded-[12px] border-[1.5px] border-line bg-paper px-3.5 py-2.5 focus-within:border-teal">
            <input
              name="note"
              type="text"
              placeholder="JazzCash, 19 Aug"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink3"
            />
          </span>
        </label>
        <SubmitButton title="Record" pendingTitle="Saving…" />
      </div>

      {outstanding > 0 ? (
        <p className="mt-2.5 text-[12px] text-ink3">Outstanding right now: {rupees(outstanding)}.</p>
      ) : null}
    </form>
  );
}

/** Suspend or restore a teacher's link. Their students and earnings are
 *  untouched either way; only new attribution stops. */
export function ToggleActive({ affiliateId, active }: { affiliateId: string; active: boolean }) {
  const [state, action] = useActionState<AdminState, FormData>(setTeacherActiveAction, {});
  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="affiliateId" value={affiliateId} />
      <input type="hidden" name="active" value={active ? 'false' : 'true'} />
      <SubmitButton
        title={active ? 'Switch the link off' : 'Switch the link back on'}
        pendingTitle="Saving…"
        variant="line"
        // A suspension is reversible and takes nothing away, so it does not get
        // a confirmation dialog. Deleting a teacher would; nothing here does.
      />
      {state.error ? <span className="text-[12.5px] text-red">{state.error}</span> : null}
      {state.ok ? <span className="text-[12.5px] text-green">{state.ok}</span> : null}
    </form>
  );
}
