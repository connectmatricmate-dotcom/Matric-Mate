'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Re-render the server tree when the language changes.
 *
 * The language lives in a cookie because the server needs it before the first
 * byte, to put `lang` and `dir` on the document and to render its own copy
 * through `t()`. Writing that cookie in the browser changes what the next
 * request would return and nothing about the page already on screen, so
 * switching to Urdu left the sidebar on the left and the server-rendered text
 * in English until the student reloaded by hand.
 *
 * `router.refresh()` rather than `location.reload()`: it re-fetches the server
 * components with the new cookie and leaves client state, scroll position and
 * any open sheet exactly where they were. A full reload would throw all of
 * that away to achieve the same thing.
 *
 * Mounted once in the app shell. The store cannot do this itself: it is a
 * plain module and `useRouter` is a hook.
 */
export function LanguageRefresh() {
  const router = useRouter();

  useEffect(() => {
    const onChange = () => router.refresh();
    window.addEventListener('mm:language', onChange);
    return () => window.removeEventListener('mm:language', onChange);
  }, [router]);

  return null;
}
