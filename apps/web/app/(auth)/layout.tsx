import Image from 'next/image';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center px-5 py-8 md:justify-center">
      <Link href="/" className="mb-6">
        <Image src="/brand/wordmark.png" alt="MatricMate" width={150} height={30} priority />
      </Link>
      <div className="w-full max-w-[420px]">{children}</div>
      <p className="mt-6 text-[12px] text-ink3">Prototype build · sample content</p>
    </div>
  );
}
