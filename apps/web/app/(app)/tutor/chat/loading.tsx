import { ChatSkeleton } from '@/components/app/skeletons';

/** The chat's own column, so a tap on a recent chat does not flash a page of list rows first. */
export default function Loading() {
  return <ChatSkeleton />;
}
