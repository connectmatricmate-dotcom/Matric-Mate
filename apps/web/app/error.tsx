'use client';

/**
 * Route error boundary. A designed failure, never a white screen or a raw stack.
 */
import { useEffect } from 'react';
import { Btn } from '@/components/ui/controls';
import { Card, Icon } from '@/components/ui/primitives';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surfaces in the server log / error tracker without showing the user a stack.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-[520px] items-center px-5">
      <Card className="w-full text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-redtint text-red">
          <Icon name="alert" size={26} />
        </span>
        <h1 className="mt-3 font-display text-[22px] text-ink">Something went wrong</h1>
        <p className="mt-1.5 text-[14px] leading-[1.6] text-ink2">
          The page couldn’t load. Try again. If it keeps happening, let us know on WhatsApp.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Btn title="Try again" onClick={reset} />
        </div>
      </Card>
    </main>
  );
}
