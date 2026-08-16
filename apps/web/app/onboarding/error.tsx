'use client';

import { RouteError } from '@/components/app/RouteError';

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} homeHref="/onboarding/class" homeLabelKey="states.restartSetup" />;
}
