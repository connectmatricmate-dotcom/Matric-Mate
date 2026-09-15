'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether this browser holds a session, for the marketing pages.
 *
 * Those pages are built once and served to everybody, so the server cannot
 * say who is looking, and a signed-in student reading the pricing page was
 * offered "Log in" and "Create account" with no way back into the app. The
 * Supabase session lives in a cookie the browser client can read (sb-…-auth-
 * token, chunked as .0, .1 for a long one), so its presence is enough to pick
 * which button to show. It is never used to decide access: a stale cookie
 * only means the button leads to the log in page, which is where the student
 * would have to go anyway.
 *
 * Signed out on the server and on the first render, so hydration matches, and
 * corrected straight after.
 */
const SESSION = /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/;

const subscribe = () => () => {};

export function useSignedIn(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => SESSION.test(document.cookie),
    () => false,
  );
}
