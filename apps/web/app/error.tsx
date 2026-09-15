'use client';

/**
 * Route error boundary. A designed failure, never a white screen or a raw stack.
 *
 * In the reader's language, like the 404 beside it: an Urdu student who hit
 * this got the one English screen left in their app. The language comes from
 * the same cookie the server reads, which this client boundary can see too.
 * Two ways on: try the page again, or go home, because a page that keeps
 * failing needs somewhere else to be.
 */
import { useEffect, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { SUPPORT_EMAIL, translate } from '@matricmate/core';
import { Btn } from '@/components/ui/controls';
import { Card, Icon, LinkBtn, Wordmark } from '@/components/ui/primitives';
import { readLanguageCookie } from '@/lib/ui-language';

const noop = () => () => {};

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surfaces in the server log / error tracker without showing the user a stack.
    console.error(error);
  }, [error]);

  const ur = useSyncExternalStore(noop, () => readLanguageCookie() === 'ur', () => false);
  const t = (key: Parameters<typeof translate>[1]) => translate('ur', key);

  return (
    <main lang={ur ? 'ur' : 'en'} dir={ur ? 'rtl' : 'ltr'} className="mx-auto flex min-h-[70vh] max-w-[520px] flex-col items-center justify-center gap-6 px-5 py-10">
      <Link href="/" aria-label="MatricMate home" className="inline-flex min-h-11 items-center">
        <Wordmark />
      </Link>
      <Card className="w-full text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-redtint text-red">
          <Icon name="alert" size={26} />
        </span>
        <h1 className="mt-3 font-display text-[22px] text-ink rtl:leading-[1.9]">{ur ? t('states.crashTitle') : 'Something went wrong'}</h1>
        <p className="mt-1.5 text-[14px] leading-[1.6] text-ink2 rtl:leading-[1.9]">
          {ur ? t('states.crashBody') : 'The page couldn’t load. Try again. If it keeps happening, write to '}
          {ur ? null : (
            <>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-extrabold text-teal wrap-anywhere hover:underline">
                {SUPPORT_EMAIL}
              </a>
              .
            </>
          )}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Btn title={ur ? t('common.retry') : 'Try again'} onClick={reset} />
          <LinkBtn title={ur ? t('states.goHome') : 'Go to the homepage'} href="/" variant="line" />
        </div>
      </Card>
    </main>
  );
}
