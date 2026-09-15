import Link from 'next/link';
import { switchAccountAction } from '@/app/(auth)/actions';
import { SubmitButton } from '@/components/ui/controls';
import { Card, Icon, LinkBtn, Wordmark } from '@/components/ui/primitives';
import { homeFor, type Role } from '@/lib/roles';

const AREA = {
  admin: { name: 'the admin account', path: '/admin' },
  affiliate: { name: 'teachers', path: '/affiliate' },
} as const;

const HOME_LABEL: Record<Role, string> = {
  student: 'Go to my dashboard',
  affiliate: 'Go to my teacher page',
  admin: 'Go to the admin panel',
};

/**
 * A staff page opened on an account it is not for: the admin panel on a
 * student's or a teacher's account, or the teacher page on anyone else's.
 *
 * It used to answer "page not found", on the reasoning that a student who
 * guesses the address should learn nothing. What it actually did was tell
 * Adnan, signed in on a test student account, that his admin panel had been
 * deleted. So it says what is true: which account this is, that the page is
 * not for it, and the two ways on (switch account and come straight back, or
 * go to this account's own home). Nothing on the page is readable without the
 * right account; the layouts still stop everything else.
 */
export function WrongAccount({ area, email, role }: { area: 'admin' | 'affiliate'; email: string | null | undefined; role: Role }) {
  const where = AREA[area];
  return (
    <div className="flex min-h-dvh flex-col items-center bg-paper px-5 py-8 md:justify-center">
      <Link href="/" className="mb-6 inline-flex min-h-11 items-center" aria-label="MatricMate home">
        <Wordmark priority />
      </Link>
      <Card className="w-full max-w-[440px]">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orangetint text-orangedark">
          <Icon name="lock" size={22} />
        </span>
        <h1 className="mt-4 font-display text-[22px] text-ink">This page is for {where.name}</h1>
        <p className="mt-2 text-[14.5px] leading-[1.65] text-ink2">
          You are signed in as <span className="font-extrabold text-ink wrap-anywhere">{email || 'another account'}</span>, which is not{' '}
          {area === 'admin' ? 'the admin account' : 'a teacher account'}. Nothing has been removed: switch to the right account
          and this page opens again.
        </p>
        <form action={switchAccountAction} className="mt-5">
          <input type="hidden" name="next" value={where.path} />
          <SubmitButton title="Switch account" pendingTitle="Signing out…" className="w-full" />
        </form>
        <LinkBtn title={HOME_LABEL[role]} href={homeFor(role)} variant="line" className="mt-3 w-full" />
      </Card>
    </div>
  );
}
