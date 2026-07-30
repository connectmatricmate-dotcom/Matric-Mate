import Image from 'next/image';
import Link from 'next/link';
import { AppProvider } from '@/lib/store';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <div className="min-h-screen">
        <header className="flex justify-center border-b border-line bg-card py-3">
          <Link href="/">
            <Image src="/brand/wordmark.png" alt="MatricMate" width={136} height={27} priority />
          </Link>
        </header>
        {children}
      </div>
    </AppProvider>
  );
}
