'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AI_QUOTA, daysLeft, formatDate, subjectById, subjectName, type Access, type StringKey } from '@matricmate/core';
import { UpgradeButton } from '@/components/commerce/UpgradeButton';
import { Page, Work } from '@/components/app/Page';
import { Card, Icon, Pill } from '@/components/ui/primitives';
import { BASIC_PLAN, THE_PLAN, rupees, type Plan } from '@/lib/plans';
import { useApp, useLang, useT } from '@/lib/store';

/** A trial or plan that has run out, and when; one switched off early; null for anything else. */
export type Lapsed =
  | { kind: 'trial'; endedAt: number }
  | { kind: 'plan'; endedAt: number; plan: 'basic' | 'premium' }
  | { kind: 'off' }
  | null;

const PERKS: Record<'basic' | 'premium', StringKey[]> = {
  basic: ['plans.basicPerk1', 'plans.basicPerk2', 'plans.basicPerk3', 'plans.basicPerk4'],
  premium: ['plans.premiumPerk1', 'plans.premiumPerk2', 'plans.premiumPerk3', 'plans.premiumPerk4'],
};

/**
 * The plans page: where a student whose trial or plan has run out comes, and
 * where one on Basic or on the free trial comes to change that.
 *
 * Premium (with AI, the one we recommend) then Basic for families for whom
 * Rs 1,000 is the obstacle. The heading says where the student is now: on a
 * trial, on Basic, a trial that ended, or a plan that ended on a date, whose
 * button then says Renew. New accounts never land here: the free trial starts
 * itself on /trial (the layout decides). Premium students never land here
 * either (the layout sends them home).
 */
export function UpgradeView({ lapsed, current }: { lapsed: Lapsed; current?: Access }) {
  const t = useT();
  const { lang } = useLang();
  const { derived, actions } = useApp();
  // The server's read of the plan, made for this page; the browser's copy
  // can lag a change made there until it asks again, which it does now.
  const access = current ?? derived.access;
  useEffect(() => {
    void actions.refreshPremium();
  }, [actions]);
  /* Premium has nothing to buy here. The layout sends it home on a full load,
     and a layout is not run again on a navigation inside the app, so a plan
     granted while the app was open landed here under the wrong heading. */
  const router = useRouter();
  const premium = access.tier === 'premium';
  useEffect(() => {
    if (premium) router.replace('/dashboard');
  }, [premium, router]);
  const until = access.validTill ? formatDate(access.validTill, lang, { day: 'numeric', month: 'long' }) : '';
  const trialSubject = subjectName(subjectById(access.trialSubject ?? ''), lang) || access.trialSubject || '';

  const head =
    access.tier === 'trial'
      ? { icon: 'clock' as const, title: t('trial.currentTitle', { subject: trialSubject }), body: t('trial.currentBody', { subject: trialSubject, date: until }) }
      : access.tier === 'basic'
        ? { icon: 'crown' as const, title: t('plans.basicCurrentTitle'), body: t('plans.basicCurrentBody', { date: until }) }
        : lapsed?.kind === 'trial'
          ? { icon: 'clock' as const, title: t('paused.trialTitle'), body: t('trial.ended') }
          : lapsed?.kind === 'plan'
            ? {
                icon: 'clock' as const,
                title: t('paused.planTitle'),
                body: t('plans.endedBody', { date: formatDate(lapsed.endedAt, lang, { day: 'numeric', month: 'long', year: 'numeric' }) }),
              }
            : lapsed?.kind === 'off'
              ? { icon: 'lock' as const, title: t('paused.noneTitle'), body: t('billing.freeBody') }
              : { icon: 'crown' as const, title: t('billing.statusFree'), body: t('billing.freeBody') };
  const renew = lapsed?.kind === 'plan' ? lapsed.plan : null;

  return (
    <Page width="focus">
      <Work className="flex flex-col gap-4">
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orangetint text-orangedark">
            <Icon name={head.icon} size={26} />
          </span>
          <h1 className="mt-4 font-display text-[26px] text-ink">{head.title}</h1>
          <p className="mx-auto mt-2 max-w-[440px] text-[14.5px] leading-[1.65] text-ink2 rtl:leading-[1.9]">{head.body}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <PlanCard plan={THE_PLAN} access={access} highlight renew={renew === 'premium'} />
          <PlanCard plan={BASIC_PLAN} access={access} renew={renew === 'basic'} />
        </div>

        <p className="text-center text-[12.5px] leading-[1.6] text-ink2 rtl:leading-[1.9]">{t('checkout.noChargeToday')}</p>
      </Work>
    </Page>
  );
}

/** `renew`: the plan this student had and let run out, so its button says Renew. */
function PlanCard({ plan, access, highlight, renew }: { plan: Plan; access: Access; highlight?: boolean; renew?: boolean }) {
  const t = useT();
  const name = t(plan.ai ? 'plans.premiumName' : 'plans.basicName');
  // The plan this student is on now: Basic is the only one that can be, here.
  const current = access.tier === 'basic' && !plan.ai;
  const upgrading = access.tier === 'basic' && plan.ai;
  /* What an upgrade does to the Basic days already paid for, the same rule
     the payment applies (carriedOver in lib/payments.ts): they carry over at
     Basic's price, so half as many Premium days. */
  // The moment the page opened: close enough for a count of days, and stable
  // across renders. Counted as the checkout page counts them, so the two agree.
  const [openedAt] = useState(() => Date.now());
  const rest = upgrading ? daysLeft(access.validTill, openedAt) : 0;
  const carried = Math.floor((rest * BASIC_PLAN.perMonth) / THE_PLAN.perMonth);
  const label = current || renew ? t('plans.renewCta', { plan: name }) : upgrading ? t('plans.upgradeCta') : t('plans.choose', { plan: name });

  return (
    <Card className={`flex flex-col ${highlight ? 'border-orange' : ''}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-[21px] text-ink">{name}</h2>
        {current ? (
          <Pill tone="green">{t('plans.current')}</Pill>
        ) : (
          <span className={`text-[12px] font-extrabold ${plan.ai ? 'text-teal' : 'text-ink3'}`}>
            {t(plan.ai ? 'plans.premiumTag' : 'plans.basicTag')}
          </span>
        )}
      </div>
      {/* latin: a price keeps the Latin face in an Urdu account. */}
      <p className="latin mt-3 font-display text-[32px] leading-none text-ink">{rupees(plan.price)}</p>
      <p className="mt-1 text-[13px] font-extrabold text-ink2">{t('checkout.perMonthUnit')}</p>
      <ul className="mt-4 flex flex-1 flex-col gap-2.5">
        {PERKS[plan.ai ? 'premium' : 'basic'].map((key) => (
          <li key={key} className="flex items-start gap-2.5">
            <Icon name="check" size={17} strokeWidth={2.6} className="mt-0.5 shrink-0 text-green" />
            <span className="text-[14px] leading-[1.6] text-ink rtl:leading-[1.9]">{t(key, { n: AI_QUOTA.premium })}</span>
          </li>
        ))}
      </ul>
      {upgrading && rest > 0 ? (
        <p className="mt-4 text-[12.5px] leading-[1.6] text-ink2 rtl:leading-[1.9]">
          {t('plans.upgradeNote', { n: rest, m: carried })}
        </p>
      ) : null}
      <div className="mt-5">
        <UpgradeButton
          plan={plan}
          label={label}
          variant={highlight ? 'orange' : 'line'}
          withPrice={false}
          icon={highlight ? 'crown' : null}
          full
          className="w-full"
        />
      </div>
    </Card>
  );
}

