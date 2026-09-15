'use client';

import { useRouter } from 'next/navigation';

/**
 * A table row that opens its page wherever it is tapped.
 *
 * The teacher's complaint, word for word: to see a student's report you had to
 * find and press the small blue name. A row cannot legally contain an anchor
 * round its cells, so the row listens for the tap itself, and the `ViewLink`
 * inside it is the real link a keyboard, a screen reader or "open in a new
 * tab" uses. On a phone, where a `stack` table turns rows into cards, the
 * whole card is the target.
 *
 * A tap on anything in the row that does its own job (a button, a link, a
 * form, a dialog opened from it) is left to that thing, and so is a drag that
 * selected text to copy.
 */
export function TapRow({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <tr
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('a, button, input, select, textarea, label, form, [role="dialog"]')) return;
        if (window.getSelection()?.toString()) return;
        router.push(href);
      }}
      className="cursor-pointer transition-colors duration-200 hover:bg-paper"
    >
      {children}
    </tr>
  );
}
