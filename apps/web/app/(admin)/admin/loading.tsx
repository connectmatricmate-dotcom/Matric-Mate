import { StaffPageSkeleton } from '@/components/staff/StaffPageSkeleton';

/**
 * Shown the moment an admin tab is tapped, inside the shell, until the page's
 * own heading arrives. Without it a tap on a slow phone connection did nothing
 * visible for a second or two, and got tapped again.
 */
export default function Loading() {
  return <StaffPageSkeleton />;
}
