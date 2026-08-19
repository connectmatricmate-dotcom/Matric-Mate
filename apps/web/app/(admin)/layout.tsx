import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { currentRole, emailAllowedAsAdmin } from '@/lib/roles';
import { signOutAction } from '@/app/(auth)/actions';
import { SignOutButton, StaffShell, type StaffNavItem } from '@/components/staff/StaffShell';

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

const NAV: StaffNavItem[] = [
  { href: '/admin', label: 'Overview', icon: 'home' },
  { href: '/admin/students', label: 'Students', icon: 'user' },
  { href: '/admin/teachers', label: 'Teachers', icon: 'share' },
  { href: '/admin/settings', label: 'Settings', icon: 'gear' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');

  const role = await currentRole();
  if (role !== 'admin' || !emailAllowedAsAdmin(data.user.email)) notFound();

  const { data: profile } = await supabase.from('profiles').select('name').eq('id', data.user.id).maybeSingle();
  const name = profile?.name?.trim() || data.user.email?.split('@')[0] || 'Admin';

  return (
    <StaffShell
      nav={NAV}
      area="admin"
      name={name}
      // Log out, not a way into the student app. An administrator has no
      // subscription, so "go to the dashboard" meant "go to the paywall", and
      // there is nothing for them there anyway.
      signOut={
        <>
          <form action={signOutAction} className="hidden md:block">
            <SignOutButton />
          </form>
          <form action={signOutAction} className="md:hidden">
            <SignOutButton compact />
          </form>
        </>
      }
    >
      {children}
    </StaffShell>
  );
}
