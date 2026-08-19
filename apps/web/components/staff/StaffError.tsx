'use client';

import { useEffect } from 'react';

/**
 * A crash inside a staff screen, with the shell around it still standing.
 *
 * Deliberately plain-spoken rather than reassuring. Adnan is the person who
 * would report this, so the message says what failed and offers the one action
 * that sometimes works, instead of an apology that tells him nothing.
 *
 * Not the student RouteError: that one is translated and speaks to a
 * fifteen year old. This audience is two people who know what a page is.
 */
export function StaffError({
  error,
  reset,
  what,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  what: string;
}) {
  useEffect(() => {
    console.error('staff route error', error);
  }, [error]);

  return (
    <div className="rounded-[16px] border border-red bg-redtint px-5 py-6">
      <h1 className="font-display text-[20px] text-ink">{what} did not load</h1>
      <p className="mt-1.5 max-w-[520px] text-[13.5px] leading-[1.6] text-ink2">
        Something on this page failed rather than returning nothing, which is on purpose: a page that quietly shows
        zeroes is worse than one that admits it broke.
      </p>
      {error.digest ? <p className="mt-2 font-mono text-[11.5px] text-ink3">Reference {error.digest}</p> : null}
      <button
        type="button"
        onClick={reset}
        className="mt-4 min-h-10 cursor-pointer rounded-full bg-teal px-4 text-[13px] font-extrabold text-onbrand transition-[filter] duration-200 hover:brightness-110"
      >
        Try again
      </button>
    </div>
  );
}
