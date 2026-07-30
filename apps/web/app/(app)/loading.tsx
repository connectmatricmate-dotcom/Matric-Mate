import { AppPageSkeleton } from '@/components/app/skeletons';

/**
 * Route-group fallback: any (app) navigation that suspends shows this inside
 * the persistent Shell instantly, so a tap always visibly does something.
 * Routes with a known shape override it with their own loading.tsx.
 */
export default function Loading() {
  return <AppPageSkeleton />;
}
