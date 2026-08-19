import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { currentRole } from '@/lib/roles';
import { signOutAction } from '@/app/(auth)/actions';
import { SignOutButton, StaffShell, type StaffNavItem } from '@/components/staff/StaffShell';

export const metadata: Metadata = { title: 'Referrals', robots: { index: false, follow: false } };

/**
 * The teacher's area.
 *
 * Its own route group for the same reason the admin one is: the student
 * layout sends anyone without a subscription to the paywall, and a teacher
 * does not have one. Putting this page under there would have shown them a
 * price list instead of their earnings.
 *
 * It wears the same shell as the admin area and the student app, which is a
 * change of mind: keeping it deliberately plain made three areas look like
 * three products. What must NOT leak across is the contents, and none of it
 * does. There is no streak, no AI budget and no chapters here, because a
 * teacher is not studying.
 */

const NAV: StaffNavItem[] = [
  { href: '/affiliate', label: 'Overview', icon: 'home' },
  { href: '/affiliate/students', label: 'Students', icon: 'user' },
  { href: '/affiliate/settings', label: 'Settings', icon: 'gear' },
];

export default async function AffiliateLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');

  /* Teachers only. An administrator sees the same numbers on
     /admin/teachers/[id], so there is nothing here they need and one fewer
     way for the two areas to bleed into each other. */
  if ((await currentRole()) !== 'affiliate') notFound();

  const { data: profile } = await supabase.from('profiles').select('name').eq('id', data.user.id).maybeSingle();
  const name = profile?.name?.trim() || data.user.email?.split('@')[0] || 'Teacher';

  return (
    <StaffShell
      nav={NAV}
      area="referrals"
      name={name}
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
