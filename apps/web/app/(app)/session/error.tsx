'use client';

import { RouteError } from '@/components/app/RouteError';

/**
 * The practice pages throw when a chapter's content read fails rather than
 * render an empty set as finished, so Try again must fetch again. See
 * learn/error.tsx: `reset` alone re-renders the same failure.
 */
export default function Error(props: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <RouteError error={props.error} reset={props.unstable_retry} homeHref="/practice" homeLabelKey="states.goBack" />;
}
