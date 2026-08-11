import { Shell } from '@/components/app/Shell';
// Side-effect import: connects the shared content layer to Supabase.
import '@/lib/content';
import { AppProvider } from '@/lib/store';

/** Renders once; child pages slot into it without rebuilding the nav. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <Shell>{children}</Shell>
    </AppProvider>
  );
}
