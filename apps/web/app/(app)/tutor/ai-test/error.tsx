'use client';

import { RouteError } from '@/components/app/RouteError';

/** Try again re-fetches the chapter lists rather than re-rendering the failure. See learn/error.tsx. */
export default function Error(props: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <RouteError error={props.error} reset={props.unstable_retry} homeHref="/tutor" homeLabelKey="states.goBack" />;
}
