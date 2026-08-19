import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { currentRole, emailAllowedAsAdmin } from '@/lib/roles';

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };

/**
 * The admin area. Adnan only.
 *
 * Its own route group rather than a page inside the student app, for a reason
 * that bites immediately: `app/(app)/layout.tsx` sends anyone without an active
 * plan to the paywall, and an administrator has no subscription. A page under
 * there would bounce to /upgrade before it rendered.
 *
 * Two locks on the door. The role has to be `admin` in the database, and the
 * address has to be on the `ADMIN_EMAILS` allowlist in the environment. This
 * area creates accounts, decides what people are paid, and records money as
 * handed over, so one edited database row should not be enough to get in.
 *
 * A wrong role gets `notFound`, not a redirect. There is no reason for a
 * student who guesses the URL to learn that this address means anything.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');

  const role = await currentRole();
  if (role !== 'admin' || !emailAllowedAsAdmin(data.user.email)) notFound();

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-30 border-b border-line bg-glass backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[1100px] items-center gap-4 px-4 md:px-8">
          <Link href="/admin" className="font-display text-[16px] text-ink">
            MatricMate <span className="text-ink3">admin</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Tab href="/admin">Overview</Tab>
            <Tab href="/admin/teachers">Teachers</Tab>
            <Tab href="/admin/account">Account</Tab>
          </nav>
          <Link
            href="/dashboard"
            className="ms-auto text-[12.5px] font-extrabold text-ink2 transition-colors duration-200 hover:text-teal"
          >
            Leave admin
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1100px] px-4 py-7 md:px-8">{children}</main>
    </div>
  );
}

function Tab({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-[10px] px-3 py-2 text-[13px] font-extrabold text-ink2 transition-colors duration-200 hover:bg-card hover:text-ink"
    >
      {children}
    </Link>
  );
}
