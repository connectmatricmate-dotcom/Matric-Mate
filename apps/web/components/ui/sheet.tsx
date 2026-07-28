'use client';

/**
 * Bottom sheet on phones, centred dialog on desktop, the same component the
 * Android app uses for the same jobs. Escape closes it, the backdrop closes it,
 * and focus moves into the panel so a keyboard user isn't stranded behind it.
 */
import { useEffect, useRef } from 'react';
import { Icon } from './primitives';

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
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-ink/40" />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative max-h-[88vh] w-full overflow-y-auto rounded-t-[22px] bg-card p-5 shadow-[0_-8px_30px_rgba(15,61,76,0.18)] outline-none md:rounded-[22px] ${
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
