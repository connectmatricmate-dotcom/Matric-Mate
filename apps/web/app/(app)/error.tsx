'use client';

import { RouteError } from '@/components/app/RouteError';

/**
 * Catches a crash inside any app screen while the Shell around it survives.
 * `unstable_retry`, not `reset`: reset only re-renders what is already here,
 * so a page that failed on a read failed again the same way. Retry fetches it.
 */
export default function Error(props: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <RouteError error={props.error} reset={props.unstable_retry} homeHref="/dashboard" homeLabelKey="states.goHome" />;
}
