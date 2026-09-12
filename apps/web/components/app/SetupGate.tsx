'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/lib/store';

/**
 * Sends a student whose account never finished setting up back to finish it.
 *
 * Nothing did. Only signup and the email link point at onboarding, so a
 * student who stopped before the board step, paid, and signed in again was
 * served FBISE Class 9 with default subjects and never asked again. That hurt
 * Punjab students most: FBISE is what an account with no board gets.
 *
 * The layout reads the account and says which step it stopped before; this
 * does the sending, on the client, and not as a redirect from the layout. A
 * sign-in finishes as a redirect to /dashboard that the router completes in
 * the browser, and a second redirect from the page it lands on is handed back
 * as a payload the router does not follow: a blank screen until a reload
 * (see landingFor in lib/roles.ts).
 *
 * The browser's own copy is checked too, so a student who has just finished
 * onboarding is not sent round again by a layout rendered before they did.
 * Account and the upgrade page stay reachable: signing out, deleting the
 * account or paying should never wait on choosing subjects.
 */
export type SetupStep = 'class' | 'board' | 'medium' | 'subjects';

export function SetupGate({ step }: { step: SetupStep | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const { state } = useApp();
  const local = state.onboarding;
  const finishedHere = Boolean(local?.board && local.subjects.length);
  const open = pathname === '/upgrade' || pathname === '/account' || pathname.startsWith('/account/');

  useEffect(() => {
    if (!step || !state.hydrated || finishedHere || open) return;
    router.replace(`/onboarding/${step}`);
  }, [step, state.hydrated, finishedHere, open, router]);

  return null;
}
