'use client';

/**
 * "Now", read once on the client and then held still.
 *
 * Calling `Date.now()` during render is impure: React may re-render at any
 * moment, so a `useMemo` keyed on a fresh timestamp would recompute for no
 * reason, and two reads in the same paint could disagree. Nothing here needs a
 * moving clock, a "last 7 days" window should not slide while someone reads it.
 *
 * The server snapshot is 0 deliberately: the store is empty until hydration, so
 * no rendered value depends on it, and the client's own clock is the one that
 * matters for a date range the user is looking at.
 */
import { useSyncExternalStore } from 'react';

const neverChanges = () => () => {};

let firstRead = 0;
const clientNow = () => (firstRead ||= Date.now());
const serverNow = () => 0;

export const useNow = () => useSyncExternalStore(neverChanges, clientNow, serverNow);
