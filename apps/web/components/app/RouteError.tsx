'use client';

/**
 * The one error card every route group's error.tsx renders, so a failure looks
 * the same everywhere and each boundary stays a three-line file. Boundaries
 * exist per group so a crash inside a screen keeps its surrounding chrome (the
 * Shell, the checkout frame) instead of tearing down to a bare page.
 */
import { useEffect } from 'react';
import { Btn } from '@/components/ui/controls';
import { Card, Icon, LinkBtn } from '@/components/ui/primitives';

export function RouteError({
  error,
  reset,
  homeHref,
  homeLabel,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref?: string;
  homeLabel?: string;
}) {
  useEffect(() => {
    // Surfaces in the server log / error tracker without showing the user a stack.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-[520px] items-center px-5">
      <Card className="w-full text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-redtint text-red">
          <Icon name="alert" size={26} />
        </span>
        <h1 className="mt-3 font-display text-[22px] text-ink">Something went wrong</h1>
        <p className="mt-1.5 text-[14px] leading-[1.6] text-ink2">
          This screen couldn&rsquo;t load. Try again. If it keeps happening, tell us from Help so we can fix it.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Btn title="Try again" onClick={reset} />
          {homeHref ? <LinkBtn title={homeLabel ?? 'Go back'} href={homeHref} variant="line" /> : null}
        </div>
      </Card>
    </main>
  );
}
