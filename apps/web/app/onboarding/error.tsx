'use client';

import { RouteError } from '@/components/app/RouteError';

/** Fetches the step again on Try again, which `reset` alone never did. See app/(app)/error.tsx. */
export default function Error(props: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <RouteError error={props.error} reset={props.unstable_retry} homeHref="/onboarding/class" homeLabelKey="states.restartSetup" />;
}
