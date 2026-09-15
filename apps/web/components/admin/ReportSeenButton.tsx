'use client';

import { startTransition, useActionState, useCallback, useState } from 'react';
import { markReportSeenAction, resetSheetAction, type AdminState } from '@/app/(admin)/actions';
import { SubmitButton } from '@/components/ui/controls';
import { Confirm } from '@/components/ui/sheet';

/** Marks a reported AI answer as read, so the count of new ones means something. */
export function ReportSeenButton({ id }: { id: string }) {
  const [state, action] = useActionState<AdminState, FormData>(markReportSeenAction, {});
  return (
    <form action={action} className="inline-flex flex-col items-start gap-1 md:items-end">
      <input type="hidden" name="reportId" value={id} />
      <SubmitButton title="Mark as seen" pendingTitle="Saving…" variant="line" />
      {state.error ? <span role="alert" className="text-[12px] text-red">{state.error}</span> : null}
    </form>
  );
}

/**
 * Throws away the cached revision sheet a report is about, so the next
 * student who opens it gets a newly written one (resetSheetAction). Asks
 * first: the new sheet is written on the client's AI credit.
 */
export function SheetResetButton({ id, chapter }: { id: string; chapter: string }) {
  const [state, dispatch, pending] = useActionState<AdminState, FormData>(resetSheetAction, {});
  const [asking, setAsking] = useState(false);
  const close = useCallback(() => setAsking(false), []);
  return (
    <span className="inline-flex flex-col items-start gap-1 md:items-end">
      {state.ok ? (
        <span role="status" className="max-w-[240px] text-[12px] font-extrabold text-green">
          {state.ok}
        </span>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => setAsking(true)}
          className="inline-flex h-11 shrink-0 cursor-pointer items-center rounded-full border border-line bg-card px-3.5 text-[12.5px] font-extrabold text-ink2 transition-colors duration-200 hover:border-red hover:text-red disabled:cursor-not-allowed disabled:opacity-60 md:h-10"
        >
          {pending ? 'Deleting…' : 'Delete this sheet'}
        </button>
      )}
      {state.error ? <span role="alert" className="max-w-[240px] text-[12px] text-red">{state.error}</span> : null}
      <Confirm
        open={asking}
        onClose={close}
        title="Delete this revision sheet?"
        body={`Every student who opens the revision sheet for ${chapter} reads this same copy. Delete it and the next one to open it gets a newly written sheet, which uses one AI request.`}
        confirmLabel="Delete the sheet"
        cancelLabel="Keep it"
        onConfirm={() => {
          setAsking(false);
          const form = new FormData();
          form.set('reportId', id);
          startTransition(() => dispatch(form));
        }}
      />
    </span>
  );
}
