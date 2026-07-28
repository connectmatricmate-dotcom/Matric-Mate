import { Shell } from '@/components/app/Shell';

/** Renders once; child pages slot into it without rebuilding the nav. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
