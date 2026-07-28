import Image from 'next/image';
import Link from 'next/link';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="flex justify-center border-b border-line bg-card py-3">
        <Link href="/">
          <Image src="/brand/wordmark.png" alt="MatricMate" width={132} height={26} priority />
        </Link>
      </header>
      {children}
    </div>
  );
}
