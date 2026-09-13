import { Localized } from '@/components/app/Localized';
import { readUiLanguage } from '@/lib/ui-language.server';
import Link from 'next/link';
import { Wordmark } from '@/components/ui/primitives';
import { AppProvider } from '@/lib/store';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const lang = await readUiLanguage();
  return (
    <Localized lang={lang}>
      <AppProvider initialLanguage={lang}>
      {/* dvh, not screen: 100vh is the height with the browser bars hidden, so
          on a phone the centred card sat lower than the space it had. */}
      <div className="flex min-h-dvh flex-col items-center px-5 py-8 md:justify-center">
        {/* The Wordmark primitive, whose plate keeps the teal half readable on
            the dark theme's paper. data-chrome keeps it off paper when printed. */}
        <Link href="/" data-chrome className="mb-6 inline-flex min-h-11 items-center" aria-label="MatricMate home">
          <Wordmark priority />
        </Link>
        <div className="w-full max-w-[420px]">{children}</div>
      </div>
      </AppProvider>
    </Localized>
  );
}
