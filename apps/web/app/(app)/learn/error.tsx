'use client';

import { RouteError } from '@/components/app/RouteError';

/**
 * The learn pages throw on purpose when a content read fails (see the chapter
 * hub), so their Try again has to fetch again. `reset` only re-renders what
 * is already here, which throws the same error straight back; `unstable_retry`
 * asks the server for the segment again.
 */
export default function Error(props: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <RouteError error={props.error} reset={props.unstable_retry} homeHref="/study" homeLabelKey="states.goBack" />;
}
