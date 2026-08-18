'use client';

import { useEffect, useRef } from 'react';
import { registerWebPush } from '@/lib/web-push';
import { useApp } from '@/lib/store';

/**
 * Keeps this browser's push registration current, without ever prompting.
 *
 * Mounted once in the app shell rather than per page, so a student who granted
 * permission months ago is re-registered on each visit: Firebase rotates and
 * expires tokens silently, and a token nobody refreshes eventually stops
 * receiving. The asking is done from the settings screen, where there is
 * something on screen explaining what is being asked for.
 */
export function PushLive() {
  const { state } = useApp();
  const done = useRef<string | null>(null);
  const userId = state.user?.id ?? null;

  useEffect(() => {
    if (!userId || done.current === userId) return;
    done.current = userId;
    // Never allowed to break a page: an unsupported browser, a blocked worker
    // and a private window all resolve rather than throw.
    void registerWebPush(false);
  }, [userId]);

  return null;
}
