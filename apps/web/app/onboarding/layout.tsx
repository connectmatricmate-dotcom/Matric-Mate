import { Localized } from '@/components/app/Localized';
import { readUiLanguage } from '@/lib/ui-language.server';
import Link from 'next/link';
import { Wordmark } from '@/components/ui/primitives';
import { AppProvider } from '@/lib/store';
import { keepStaffOut } from '@/lib/roles';

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  // Setting up as a student is not something a teacher or an administrator
  // does, and there is no plan at the end of it for them to use.
  await keepStaffOut();
  const lang = await readUiLanguage();
  return (
    <Localized lang={lang}>
      <AppProvider initialLanguage={lang}>
      <div className="min-h-screen">
        <header className="flex justify-center border-b border-line bg-card py-3">
          <Link href="/">
            <Wordmark priority />
          </Link>
        </header>
        {children}
      </div>
      </AppProvider>
    </Localized>
  );
}
