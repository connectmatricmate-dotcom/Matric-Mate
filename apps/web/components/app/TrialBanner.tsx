'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { daysLeft, subjectById, subjectName } from '@matricmate/core';
import { Icon } from '@/components/ui/primitives';
import { useApp, useLang, useT } from '@/lib/store';

/**
 * A strip across the top of every screen while a free trial runs: which
 * subject it opens and how many days are left, and the way to the plans.
 *
 * A trial that ends without warning reads as the app breaking, three days in,
 * on the one subject the student had started to trust it with. So the count
 * is always in view, and it says "last day" rather than "1 days left".
 */
export function TrialBanner() {
  const { derived } = useApp();
  const t = useT();
  const { lang } = useLang();
  const pathname = usePathname();
  const access = derived.access;
  // The plans page says all of this in its own heading.
  if (access.tier !== 'trial' || pathname === '/upgrade') return null;

  const subject = subjectName(subjectById(access.trialSubject ?? ''), lang) || access.trialSubject || '';
  const left = daysLeft(access.validTill);
  return (
    <div className="mx-auto mb-5 flex max-w-[1180px] flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[14px] bg-orangetint px-4 py-2.5">
      <Icon name="clock" size={16} className="shrink-0 text-orangedark" />
      <p className="min-w-0 flex-1 text-[13px] font-extrabold text-orangedark">
        {left <= 1 ? t('trial.bannerOne', { subject }) : t('trial.banner', { subject, n: left })}
      </p>
      <Link
        href="/upgrade"
        className="inline-flex min-h-10 items-center rounded-full px-2 text-[13px] font-extrabold text-orangedark underline-offset-4 transition-colors duration-200 hover:underline"
      >
        {t('trial.seePlans')}
      </Link>
    </div>
  );
}
