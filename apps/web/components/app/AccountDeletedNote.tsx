'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import { translate } from '@matricmate/core';
import { Icon } from '@/components/ui/primitives';
import { readLanguageCookie } from '@/lib/ui-language';

const neverChanges = () => () => {};
const cookieLang = () => readLanguageCookie() ?? 'en';

/**
 * "Your account was deleted", on the page a student lands on after deleting
 * it from Settings (/?deleted=1). Without it the home page simply appeared,
 * and nothing said whether the account had gone or the button had failed.
 *
 * In the language the student was using, from the cookie: the signed-out page
 * has no store to ask. Closing it takes the flag out of the address, so a
 * reload or a shared link does not say it again.
 */
export function AccountDeletedNote() {
  const params = useSearchParams();
  const [closed, setClosed] = useState(false);
  const lang = useSyncExternalStore(neverChanges, cookieLang, () => 'en' as const);
  if (closed || params.get('deleted') !== '1') return null;

  const close = () => {
    setClosed(true);
    const url = new URL(window.location.href);
    url.searchParams.delete('deleted');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  };

  return (
    <div
      role="status"
      lang={lang}
      dir={lang === 'ur' ? 'rtl' : 'ltr'}
      className="fixed inset-x-4 top-[calc(env(safe-area-inset-top)+1rem)] z-50 mx-auto flex max-w-[480px] items-start gap-3 rounded-[16px] border border-green bg-card p-4 shadow-[0_10px_30px_var(--shadow-lift)]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-greentint text-green">
        <Icon name="check" size={18} strokeWidth={2.6} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[16px] text-ink rtl:leading-[1.9]">{translate(lang, 'deletion.doneTitle')}</p>
        <p className="mt-0.5 text-[13.5px] leading-[1.6] text-ink2 rtl:leading-[1.9]">{translate(lang, 'deletion.doneBody')}</p>
      </div>
      <button
        type="button"
        onClick={close}
        aria-label={translate(lang, 'common.close')}
        className="-m-1.5 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[12px] text-ink2 transition-colors duration-200 hover:bg-paper hover:text-ink"
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}
