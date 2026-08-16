import { Localized } from '@/components/app/Localized';
import { readUiLanguage } from '@/lib/ui-language.server';
import Image from 'next/image';
import Link from 'next/link';
import { AppProvider } from '@/lib/store';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const lang = await readUiLanguage();
  return (
    <Localized lang={lang}>
      <AppProvider initialLanguage={lang}>
      <div className="flex min-h-screen flex-col items-center px-5 py-8 md:justify-center">
        <Link href="/" className="mb-6">
          <Image src="/brand/wordmark.png" alt="MatricMate" width={136} height={27} priority />
        </Link>
        <div className="w-full max-w-[420px]">{children}</div>
      </div>
      </AppProvider>
    </Localized>
  );
}
