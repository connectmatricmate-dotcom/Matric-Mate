'use client';

/**
 * The shell both staff areas wear: administrator and teacher.
 *
 * It is the student shell's layout on purpose. Sidebar on desktop, bottom bar
 * on a phone, one sticky header of fixed height, the same spacing and the same
 * type. Three areas that looked like three products was the complaint, and it
 * is also a real cost: a header that moves between pages makes the app feel
 * assembled rather than built.
 *
 * Not the student `Shell` itself, though, and that is not laziness. That
 * component reads the student store for a streak, an AI budget, XP and a
 * notification list, none of which exist for staff, and none of which a
 * teacher should be shown. This takes what to render as props instead, so the
 * layout is shared while the contents stay honest about who is looking.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { IconName } from '@matricmate/core';
import { Icon, Wordmark } from '@/components/ui/primitives';

export type StaffNavItem = {
  href: string;
  label: string;
  icon: IconName;
  /** Other prefixes this tab owns, so a teacher's detail page keeps Teachers lit. */
  owns?: string[];
};

function isActive(pathname: string, item: StaffNavItem) {
  return [item.href, ...(item.owns ?? [])].some((base) => pathname === base || pathname.startsWith(`${base}/`));
}

export function StaffShell({
  nav,
  area,
  name,
  signOut,
  children,
}: {
  nav: StaffNavItem[];
  /** The word under the wordmark: "admin", "referrals". */
  area: string;
  name: string;
  /** The sign-out form, passed in because a server action cannot be imported here. */
  signOut: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const home = nav[0]?.href ?? '/';

  return (
    <div className="min-h-screen md:flex">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col border-e border-line bg-card px-3 py-5 md:flex">
        <Link href={home} className="mb-1 px-2">
          <Wordmark priority />
        </Link>
        <p className="mb-6 px-2 text-[11.5px] font-extrabold uppercase tracking-[0.08em] text-ink3">{area}</p>

        <nav className="flex flex-col gap-1">
          {nav.map((item) => {
            const on = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={on ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-[12px] px-3 text-[13.5px] font-extrabold transition-colors duration-200 ${
                  on ? 'bg-tealtint text-teal' : 'text-ink2 hover:bg-paper hover:text-ink'
                }`}
              >
                <Icon name={item.icon} size={19} strokeWidth={on ? 2.5 : 2.2} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-[16px] border border-line px-3 py-3">
          <span className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tealtint text-[13px] font-extrabold text-teal">
              {name.trim().charAt(0).toUpperCase() || '?'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-extrabold text-ink">{name}</span>
              <span className="block text-[11.5px] capitalize text-ink2">{area}</span>
            </span>
          </span>
          <span className="mt-2.5 block">{signOut}</span>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Same h-14 contract as the student shell, so a sticky heading inside
            a page can pin itself to top-14 in either area. */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-glass px-4 backdrop-blur md:px-8">
          <Link href={home} className="flex items-center gap-2 md:hidden">
            <Wordmark width={104} height={21} />
            <span className="text-[12.5px] font-extrabold text-ink3">{area}</span>
          </Link>

          <div className="ms-auto flex items-center gap-3">
            <span className="hidden text-[12.5px] font-extrabold text-ink2 md:inline">{name}</span>
            <span className="md:hidden">{signOut}</span>
          </div>
        </header>

        <main className="w-full flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-16">{children}</main>
      </div>

      {/* phone bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        {nav.map((item) => {
          const on = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={on ? 'page' : undefined}
              className={`group flex min-h-[58px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold ${
                on ? 'text-teal' : 'text-ink2'
              }`}
            >
              <span
                className={`flex items-center justify-center rounded-full px-3.5 py-0.5 transition-all duration-200 ${
                  on ? 'motion-safe:animate-[tabland_260ms_ease-out] bg-tealtint' : 'bg-transparent'
                }`}
              >
                <Icon name={item.icon} size={20} strokeWidth={on ? 2.5 : 2.2} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/** The sign-out control, styled for the sidebar card and the phone header. */
export function SignOutButton({ compact = false }: { compact?: boolean }) {
  return compact ? (
    <button
      type="submit"
      aria-label="Log out"
      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[12px] border border-line bg-card text-ink transition-colors duration-200 hover:bg-paper"
    >
      <Icon name="logout" size={18} />
    </button>
  ) : (
    <button
      type="submit"
      className="flex min-h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-line bg-paper text-[12.5px] font-extrabold text-ink2 transition-colors duration-200 hover:border-red hover:text-red"
    >
      <Icon name="logout" size={15} />
      Log out
    </button>
  );
}
