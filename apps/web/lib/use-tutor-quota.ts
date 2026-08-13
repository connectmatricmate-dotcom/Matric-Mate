'use client';

import { useEffect, useState } from 'react';
import { fetchTutorQuota } from '@matricmate/core';
import type { TutorQuota } from '@matricmate/core';

/**
 * The server's tutor quota, fetched once on mount. Null while loading or when
 * the fetch fails, so callers can fall back to the local mirror. The setter
 * is exposed because every tutor answer carries a fresh quota snapshot, and
 * applying it beats refetching.
 */
export function useTutorQuota() {
  const [quota, setQuota] = useState<TutorQuota | null>(null);
  useEffect(() => {
    let alive = true;
    fetchTutorQuota().then((q) => {
      if (alive && q) setQuota(q);
    });
    return () => {
      alive = false;
    };
  }, []);
  return [quota, setQuota] as const;
}

/** "21:00" style local clock time out of the server's reset instant. */
export const quotaClock = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
