import { StatGrid } from '@/components/admin/bits';
import { Skeleton } from '@/components/ui/primitives';

/**
 * The shape every staff page shares: a heading, a line under it, a row of
 * figures and a panel. The pages stream their own sections with skeletons of
 * their own; this covers the moment before the page itself has started.
 */
export function StaffPageSkeleton() {
  return (
    <div aria-busy="true">
      <Skeleton className="h-8 w-44" />
      <Skeleton className="mt-2 mb-6 h-4 w-full max-w-[420px]" />
      <StatGrid>
        {['a', 'b', 'c', 'd'].map((k) => (
          <div key={k} className="h-[80px] animate-pulse rounded-[16px] border border-line bg-card" />
        ))}
      </StatGrid>
      <div className="mt-7">
        <Skeleton className="mb-2.5 h-[25px] w-32" />
        <div className="h-[260px] animate-pulse rounded-[16px] border border-line bg-card" />
      </div>
    </div>
  );
}
