import { Localized } from '@/components/app/Localized';
import { readUiLanguage } from '@/lib/ui-language.server';
import Image from 'next/image';
import Link from 'next/link';
import { AppProvider } from '@/lib/store';

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const lang = await readUiLanguage();
  return (
    <Localized lang={lang}>
      <AppProvider initialLanguage={lang}>
      <div className="min-h-screen">
        <header className="flex justify-center border-b border-line bg-card py-3">
          <Link href="/">
            <Image src="/brand/wordmark.png" alt="MatricMate" width={136} height={27} priority />
          </Link>
        </header>
        {children}
      </div>
      </AppProvider>
    </Localized>
  );
}
