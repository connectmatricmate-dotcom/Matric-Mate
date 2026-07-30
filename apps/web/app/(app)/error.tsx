'use client';

import { RouteError } from '@/components/app/RouteError';

/** Catches a crash inside any app screen while the Shell around it survives. */
export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} homeHref="/dashboard" homeLabel="Go to Home" />;
}
