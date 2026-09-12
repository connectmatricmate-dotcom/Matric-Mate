'use client';

/**
 * Bottom sheet on phones, centred dialog on desktop, the same component the
 * Android app uses for the same jobs. Escape closes it, the backdrop closes it,
 * and focus moves into the panel so a keyboard user isn't stranded behind it.
 */
import { useEffect, useRef } from 'react';
import { Icon } from './primitives';
import { Btn } from './controls';

export function Sheet({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Where focus came from, so closing puts the keyboard user back there.
    const opener = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // aria-modal promises focus stays inside; without this trap, Tab walks
      // out into the inert page behind the sheet.
      if (e.key === 'Tab' && panel.current) {
        const focusables = panel.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === panel.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    // Restore what was there, not ''. A sheet opened over another overlay
    // that had already locked the page would otherwise unlock it on close.
    // Same pattern as AiWorking.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-scrim" />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        /* dvh, not vh: on a phone vh is the height with the browser's bars
           hidden, so an 88vh sheet ran under the address bar. The bottom
           padding clears the home indicator on a notched phone; overscroll
           stays in the sheet instead of scrolling the page behind it. */
        className={`relative max-h-[88dvh] w-full overflow-y-auto overscroll-contain rounded-t-[22px] bg-card px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-8px_30px_var(--shadow-sheet)] outline-none md:rounded-[22px] md:pb-5 ${
          wide ? 'md:max-w-[640px]' : 'md:max-w-[460px]'
        }`}
      >
        <div className="mb-3 flex items-center gap-2">
          <h2 className="min-w-0 flex-1 font-display text-[19px] text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] text-ink2 transition-colors duration-200 hover:bg-paper"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Ask before doing something that cannot be undone.
 *
 * Every confirmation was the same handful of lines written out again: a sheet,
 * a title, a sentence, the action, a cancel. Repeated, they drift, and they
 * had: one dialog put cancel on the left as a small outline button while the
 * others put it underneath as a ghost. One component means the answer is
 * always in the same place and the way out is always the same word, on both
 * apps, because the Android side has the twin of this.
 *
 * The cancel is a button AND the backdrop, so there are two ways out and
 * neither of them is the destructive one. `tone` colours only the confirm.
 */
export function Confirm({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  onConfirm,
  cancelLabel,
  tone = 'danger',
  loading,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** A string, or your own nodes when the sentence needs more than one style. */
  body: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  cancelLabel: string;
  tone?: 'danger' | 'orange' | 'primary';
  loading?: boolean;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {typeof body === 'string' ? <p className="text-[13.5px] leading-[1.6] text-ink2">{body}</p> : body}
      <div className="mt-5 flex flex-col gap-2.5">
        <Btn title={confirmLabel} variant={tone} onClick={onConfirm} loading={loading} />
        <Btn title={cancelLabel} variant="ghost" onClick={onClose} disabled={loading} />
      </div>
    </Sheet>
  );
}
