'use client';

/**
 * Brief confirmations, "Saved", "Added to downloads". Announced politely so a
 * screen reader hears them without losing the user's place. Anything the user
 * must act on is an ErrorBanner or a dialog, not a toast.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

type Toast = { id: number; message: string };
const ToastCtx = createContext<((message: string) => void) | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string) => {
    const id = nextId++;
    setToasts((list) => [...list, { id, message }]);
  }, []);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((x) => x.id !== id)), []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-8"
      >
        {toasts.map((toast) => (
          <ToastRow key={toast.id} toast={toast} onDone={dismiss} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastRow({ toast, onDone }: { toast: Toast; onDone: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDone(toast.id), 2600);
    return () => clearTimeout(timer);
  }, [toast.id, onDone]);

  return (
    <div className="max-w-[440px] rounded-[14px] bg-ink px-4 py-2.5 text-[13.5px] font-bold text-paper shadow-[0_8px_22px_var(--shadow-lift)]">
      {toast.message}
    </div>
  );
}

export function useToast() {
  const show = useContext(ToastCtx);
  if (!show) throw new Error('useToast must be used inside ToastProvider');
  return show;
}
