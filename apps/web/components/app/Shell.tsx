'use client';

/**
 * The app shell: sidebar on desktop, bottom bar on phones, and a slim utility
 * strip carrying the three things worth glancing at, streak, AI questions
 * left, notifications. Rendered once by app/(app)/layout.tsx and preserved
 * across navigation; pages render only their own content.
 */
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { IconName, StringKey } from '@matricmate/core';
import { levelProgress } from '@matricmate/core';
import { Bar, Icon } from '@/components/ui/primitives';
import { AvatarBadge } from '@/components/ui/AvatarBadge';
import { useApp, useT } from '@/lib/store';

/**
 * `owns` lists the other route prefixes that belong to a tab, a chapter lives
 * at /learn/... but is still "Study", and a running test is still "Practice".
 */
const NAV: { href: string; label: StringKey; icon: IconName; owns?: string[] }[] = [
  { href: '/dashboard', label: 'tabs.home', icon: 'home' },
  { href: '/study', label: 'tabs.study', icon: 'book', owns: ['/learn'] },
  { href: '/practice', label: 'tabs.practice', icon: 'target', owns: ['/session'] },
  { href: '/tutor', label: 'tabs.tutor', icon: 'spark' },
  { href: '/progress', label: 'tabs.progress', icon: 'chart', owns: ['/insights'] },
];

function isActive(pathname: string, item: (typeof NAV)[number]) {
  return [item.href, ...(item.owns ?? [])].some((base) => pathname === base || pathname.startsWith(`${base}/`));
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useT();
  const { state, derived } = useApp();
  const unread = state.notifications.some((n) => !n.read);

  // No client-side auth redirect: proxy.ts turns away unauthenticated requests
  // before this renders, so there is nothing to flash and nothing to guard here.

  return (
    <div className="min-h-screen md:flex">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col border-r border-line bg-card px-3 py-5 md:flex">
        <Link href="/dashboard" className="mb-7 px-2">
          <Image src="/brand/wordmark.png" alt="MatricMate" width={136} height={27} priority />
        </Link>

        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
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
                <Icon name={item.icon} size={20} />
                {t(item.label)}
              </Link>
            );
          })}
        </nav>

        {/*
          A named way into settings. It existed only behind the avatar card
          below, which nothing marks as clickable, and a student who cannot
          find settings blames the app, not themselves.
        */}
        <Link
          href="/account/settings"
          className="mt-auto flex min-h-11 items-center gap-3 rounded-[12px] px-3 text-[13.5px] font-extrabold text-ink2 transition-colors duration-200 hover:bg-paper hover:text-ink"
        >
          <Icon name="gear" size={20} />
          {t('account.settings')}
        </Link>

        {/* Level sits in the margin all day, so it stays quiet: a name, a number, a line. */}
        <Link
          href="/account"
          className="mt-2 rounded-[16px] border border-line px-3 py-3 transition-colors duration-200 hover:border-tealtint2 hover:bg-paper"
        >
          <span className="flex items-center gap-2.5">
            <AvatarBadge index={state.settings.avatar ?? 0} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-extrabold text-ink">{state.user?.name ?? 'Account'}</span>
              <span className="block text-[11.5px] text-ink2">
                Level {derived.level} · {state.xp.toLocaleString()} XP
              </span>
            </span>
          </span>
          <span className="mt-2 block">
            <Bar pct={levelProgress(state.xp)} h={5} />
          </span>
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* utility strip, streak, AI budget, notifications */}
        {/* Fixed h-14: screen-level sticky headers pin themselves to top-14,
            so the shell's height is a contract, not a measurement. */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-paper/90 px-4 backdrop-blur md:px-8">
          <Link href="/dashboard" className="md:hidden">
            <Image src="/brand/wordmark.png" alt="MatricMate" width={116} height={23} />
          </Link>

          <div className="ml-auto flex items-center gap-2">
            {derived.streak > 0 ? (
              <Link
                href="/progress"
                title={t('progress.streakAlive', { n: derived.streak })}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-orangetint px-3 text-[13px] font-extrabold text-orangedark transition-colors duration-200 hover:brightness-95"
              >
                <span className="fx-pulse inline-flex">
                  <Icon name="flame" size={14} strokeWidth={2.4} />
                </span>
                {derived.streak}
              </Link>
            ) : null}

            <Link
              href="/tutor"
              title={t('tutor.leftToday', { n: derived.aiLeft })}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-extrabold transition-colors duration-200 hover:brightness-95 ${
                derived.aiLeft ? 'bg-tealtint text-teal' : 'bg-redtint text-red'
              }`}
            >
              <Icon name="spark" size={14} strokeWidth={2.4} />
              {derived.aiLeft}/{derived.aiLimit}
            </Link>

            <Link
              href="/notifications"
              aria-label={t('notifications.title')}
              className="relative flex h-10 w-10 items-center justify-center rounded-[12px] border border-line bg-card text-ink transition-colors duration-200 hover:bg-paper"
            >
              <Icon name="bell" size={19} />
              {unread ? (
                <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-card bg-orange" />
              ) : null}
            </Link>
          </div>
        </header>

        <main className="w-full flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-16">{children}</main>
      </div>

      {/* phone bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map((item) => {
          const on = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={on ? 'page' : undefined}
              className={`flex min-h-[58px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-extrabold ${
                on ? 'text-teal' : 'text-ink2'
              }`}
            >
              <Icon name={item.icon} size={22} />
              {t(item.label)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
