'use client';

/**
 * The one error card every route group's error.tsx renders, so a failure looks
 * the same everywhere and each boundary stays a three-line file. Boundaries
 * exist per group so a crash inside a screen keeps its surrounding chrome (the
 * Shell, the checkout frame) instead of tearing down to a bare page.
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { type StringKey, translate } from '@matricmate/core';
import { Btn } from '@/components/ui/controls';
import { Card, Icon, LinkBtn } from '@/components/ui/primitives';
import { getServerSnapshot, getSnapshot, subscribe } from '@/lib/persisted-store';

export function RouteError({
  error,
  reset,
  homeHref,
  homeLabelKey,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref?: string;
  /** A string key, not a sentence: this card renders in the student's language. */
  homeLabelKey?: StringKey;
}) {
  /**
   * Not useT(): this is an error boundary, and a hook that throws when its
   * provider is missing would turn a recoverable screen crash into a blank
   * page. The store lives outside React, so reading the language straight from
   * it gives the same strings and falls back to English instead of failing.
   */
  const lang = useSyncExternalStore(
    subscribe,
    () => getSnapshot().settings.language,
    () => getServerSnapshot().settings.language,
  );
  const t = useCallback((key: StringKey) => translate(lang, key), [lang]);

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
        <h1 className="mt-3 font-display text-[22px] text-ink">{t('states.crashTitle')}</h1>
        <p className="mt-1.5 text-[14px] leading-[1.6] text-ink2">{t('states.crashBody')}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Btn title={t('common.retry')} onClick={reset} />
          {homeHref ? <LinkBtn title={t(homeLabelKey ?? 'states.goBack')} href={homeHref} variant="line" /> : null}
        </div>
      </Card>
    </main>
  );
}
