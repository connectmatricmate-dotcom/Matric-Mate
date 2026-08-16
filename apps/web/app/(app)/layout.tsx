import { Localized } from '@/components/app/Localized';
import { readUiLanguage } from '@/lib/ui-language.server';
import { Shell } from '@/components/app/Shell';
// Side-effect import: connects the shared content layer to Supabase.
import '@/lib/content';
import { AppProvider } from '@/lib/store';

/** Renders once; child pages slot into it without rebuilding the nav. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const lang = await readUiLanguage();
  return (
    <Localized lang={lang}>
      <AppProvider initialLanguage={lang}>
        <Shell>{children}</Shell>
      </AppProvider>
    </Localized>
  );
}
