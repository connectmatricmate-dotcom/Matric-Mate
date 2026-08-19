import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { currentRole } from '@/lib/roles';
import { signOutAction } from '@/app/(auth)/actions';
import { Wordmark } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Referrals', robots: { index: false, follow: false } };

/**
 * The teacher's area.
 *
 * Its own route group for the same reason the admin one is: the student
 * layout sends anyone without a subscription to the paywall, and a teacher
 * does not have one. Putting this page under there would have shown them a
 * price list instead of their earnings.
 *
 * Deliberately not the student shell either. There is no bottom tab bar, no
 * streak, no AI budget. A teacher is not studying, and dressing their
 * dashboard as a student's would raise the obvious question of where their
 * chapters are.
 */
export default async function AffiliateLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');

  /* Teachers only. An administrator sees the same numbers on
     /admin/teachers/[id], so there is nothing here they need and one fewer
     way for the two areas to bleed into each other. */
  if ((await currentRole()) !== 'affiliate') notFound();

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-30 border-b border-line bg-glass backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[980px] items-center gap-4 px-4 md:px-8">
          <span className="flex items-center gap-2">
            <Wordmark width={104} height={21} />
            <span className="text-[12.5px] font-extrabold text-ink3">referrals</span>
          </span>
          <form action={signOutAction} className="ms-auto">
            <button
              type="submit"
              className="text-[12.5px] font-extrabold text-ink2 transition-colors duration-200 hover:text-teal"
            >
              Log out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[980px] px-4 py-7 md:px-8">{children}</main>
    </div>
  );
}
