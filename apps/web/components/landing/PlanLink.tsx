'use client';

import { LinkBtn } from '@/components/ui/primitives';
import type { BtnVariant } from '@/components/ui/styles';
import { useSignedIn } from './useSignedIn';

/**
 * "Get Premium" and "Get Basic" on the marketing pages.
 *
 * Checkout needs an account, and a visitor without one was sent to the log
 * in page, which greets them with "Welcome back": most people pressing this
 * have never been here. Signed out, the button now starts at sign-up and
 * carries on to the plan afterwards; signed in, it goes straight to the plan.
 */
export function PlanLink({ title, planId, variant, className }: { title: string; planId: string; variant?: BtnVariant; className?: string }) {
  const signedIn = useSignedIn();
  const checkout = `/checkout?plan=${planId}`;
  return <LinkBtn title={title} href={signedIn ? checkout : `/signup?next=${encodeURIComponent(checkout)}`} variant={variant} className={className} />;
}
