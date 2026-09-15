'use client';

import { useActionState } from 'react';
import { markReportSeenAction, type AdminState } from '@/app/(admin)/actions';
import { SubmitButton } from '@/components/ui/controls';

/** Marks a reported AI answer as read, so the count of new ones means something. */
export function ReportSeenButton({ id }: { id: string }) {
  const [state, action] = useActionState<AdminState, FormData>(markReportSeenAction, {});
  return (
    <form action={action} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="reportId" value={id} />
      <SubmitButton title="Mark as seen" pendingTitle="Saving…" variant="line" />
      {state.error ? <span className="text-[12px] text-red">{state.error}</span> : null}
    </form>
  );
}
