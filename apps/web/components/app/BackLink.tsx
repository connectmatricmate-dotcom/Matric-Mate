'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { translate } from '@matricmate/core';
import { Icon } from '@/components/ui/primitives';
import { canGoBack, subscribeTrail } from '@/lib/nav-trail';
import { useStoreLanguage } from '@/lib/store';

const pageLang = () => (document.documentElement.lang === 'ur' ? 'ur' : 'en');

/**
 * A back link that goes back.
 *
 * With a page of ours behind this one, it is the browser's back: to wherever
 * the student really came from, saying "Back", and without adding a history
 * entry for the browser's own button to walk into later. Opened on its own (a
 * shared link, a new tab), there is nothing to go back to, so it is a link to
 * the page's parent under that page's name, as every back link used to be.
 */
export function BackLink({ href, label, className }: { href: string; label?: string; className?: string }) {
  const router = useRouter();
  const back = useSyncExternalStore(subscribeTrail, canGoBack, () => false);
  /* The app's own language first. The document's is set once, by the server,
     from the cookie, and did not follow a switch made in the app, so after a
     switch to Urdu every back link read "Back". */
  const docLang = useSyncExternalStore(subscribeTrail, pageLang, () => 'en' as const);
  const lang = useStoreLanguage() ?? docLang;
  return (
    <Link
      href={href}
      onClick={(e) => {
        if (!canGoBack() || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        router.back();
      }}
      className={className}
    >
      <Icon name="chevron" size={17} className="rotate-180" />
      {back ? translate(lang, 'common.back') : (label ?? translate(lang, 'common.back'))}
    </Link>
  );
}
