'use client';

import { RouteError } from '@/components/app/RouteError';

/**
 * A crash on the payment path must never strand the buyer without a way back.
 * No money moves from a render error: the gateway confirms server-side.
 */
export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} homeHref="/pricing" homeLabelKey="states.backToPlans" />;
}
