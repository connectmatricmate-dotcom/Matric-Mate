'use client';

import { AI_QUOTA, formatDate, subjectById, subjectName } from '@matricmate/core';
import { UpgradeButton } from '@/components/commerce/UpgradeButton';
/**
 * The web app is the only surface where a subscription can be started, renewed
 * or cancelled, the Android build shows the same status read-only, because
 * Google Play forbids it from linking to a checkout. See core/billing.ts.
 */
import type { IconName, StringKey } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { lapseLines } from '@/components/app/planStatus';
import { useState } from 'react';
import { Btn } from '@/components/ui/controls';
import { Card, Icon, Item, LinkBtn, Pill, SectionTitle } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { BASIC_PLAN, THE_PLAN, planName } from '@/lib/plans';
import { useApp, useLang, useT } from '@/lib/store';

const PERKS: [IconName, StringKey][] = [
  ['book', 'billing.perk1'],
  ['target', 'billing.perk2'],
  ['spark', 'billing.perk3'],
  ['chart', 'billing.perk4'],
  ['download', 'billing.perk5'],
];

/** Basic's list, and below it the AI that Premium adds (see accessFor in core). */
const BASIC_PERKS: [IconName, StringKey][] = [
  ['book', 'plans.basicPerk1'],
  ['target', 'plans.basicPerk2'],
  ['chart', 'plans.basicPerk3'],
  ['download', 'plans.basicPerk4'],
];
const PREMIUM_EXTRAS: [IconName, StringKey][] = [
  ['spark', 'plans.premiumPerk2'],
  ['check', 'plans.premiumPerk3'],
  ['quill', 'plans.premiumPerk4'],
];

export function SubscriptionView() {
  const { state, actions, derived } = useApp();
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const [checking, setChecking] = useState(false);
  const access = derived.access;
  const active = access.active;
  const tier = access.tier;
  /* The stored id for Premium, which can still say a retired length on an old
     row ("Full year"); the tier for the other two. */
  const planLabel = tier === 'premium' ? planName(state.premium.plan ?? 'monthly', lang) : tier ? planName(tier, lang) : '';
  const trialSubject = tier === 'trial' ? subjectName(subjectById(access.trialSubject ?? ''), lang) || access.trialSubject || '' : '';
  // Ended, switched off, or never: the plan reminders open this page, and it
  // answered all three with "No plan yet".
  const lapse = lapseLines(state.premium.lapse, lang);

  return (
    <Page width="focus">
      <PageHead back="/account" backLabel={t('account.title')} title={t('account.subscriptionTitle')} />

      <Card border={active ? 'border-orange' : undefined} className="flex items-center gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] ${
            active ? 'bg-orange text-onbrand' : 'bg-grey text-ink2'
          }`}
        >
          <Icon name={active ? 'crown' : 'lock'} size={21} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-extrabold text-ink">
            {active ? [t('billing.statusActive'), planLabel, trialSubject].filter(Boolean).join(' · ') : state.premium.lapse ? lapse.title : t('billing.statusFree')}
          </p>
          <p className="text-[13px] text-ink2">
            {active && state.premium.validTill
              ? t('billing.activeTill', {
                  date: formatDate(state.premium.validTill, lang, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }),
                })
              : state.premium.lapse
                ? lapse.sub
                : t('billing.freeBody')}
          </p>
        </div>
        <Pill tone={active ? 'green' : 'grey'}>{active ? t('account.active') : t('account.inactive')}</Pill>
      </Card>

      {/* For the student who just paid in another tab and does not trust the
          screen to have noticed. Re-reads the server; it cannot grant anything. */}
      <div className="mt-3">
        <Btn
          title={t('billing.checkAgain')}
          variant="line"
          sm
          icon="refresh"
          loading={checking}
          onClick={async () => {
            setChecking(true);
            const on = await actions.refreshPremium();
            setChecking(false);
            toast(t(on ? 'billing.checkedActive' : 'billing.checkedFree'));
          }}
        />
      </div>

      {tier === 'basic' ? (
        <>
          <SectionTitle>{t('plans.basicIncludes')}</SectionTitle>
          <Card flat>
            <ul className="flex flex-col gap-4">
              {BASIC_PERKS.map(([icon, key]) => (
                <li key={key} className="flex items-center gap-3">
                  <Icon name={icon} size={18} className="shrink-0 text-teal" />
                  <span className="min-w-0 flex-1 text-[14px] leading-[1.5] text-ink rtl:leading-[1.9]">{t(key)}</span>
                  <Icon name="check" size={16} strokeWidth={2.6} className="shrink-0 text-green" />
                </li>
              ))}
            </ul>
          </Card>
          <SectionTitle>{t('plans.notInBasic')}</SectionTitle>
          <Card flat>
            <ul className="flex flex-col gap-4">
              {PREMIUM_EXTRAS.map(([icon, key]) => (
                <li key={key} className="flex items-center gap-3">
                  <Icon name={icon} size={18} className="shrink-0 text-ink3" />
                  <span className="min-w-0 flex-1 text-[14px] leading-[1.5] text-ink2 rtl:leading-[1.9]">{t(key, { n: AI_QUOTA.premium })}</span>
                  <Icon name="lock" size={15} className="shrink-0 text-ink3" />
                </li>
              ))}
            </ul>
          </Card>
        </>
      ) : (
        <>
          <SectionTitle>{t('billing.whatsIncluded')}</SectionTitle>
          <Card flat>
            <ul className="flex flex-col gap-4">
              {PERKS.map(([icon, key]) => {
                // Premium's list: ticked on Premium, a preview on anything else.
                const on = tier === 'premium';
                return (
                  <li key={key} className="flex items-center gap-3">
                    <Icon name={icon} size={18} className={`shrink-0 ${on ? 'text-teal' : 'text-ink3'}`} />
                    <span className={`min-w-0 flex-1 text-[14px] leading-[1.5] rtl:leading-[1.9] ${on ? 'text-ink' : 'text-ink2'}`}>{t(key)}</span>
                    {on ? <Icon name="check" size={16} strokeWidth={2.6} className="shrink-0 text-green" /> : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      )}

      <div className="mt-6 flex flex-col gap-2.5">
        {tier === 'premium' ? (
          <UpgradeButton plan={THE_PLAN} label={t('plans.renewCta', { plan: t('plans.premiumName') })} variant="orange" icon="card" full />
        ) : tier === 'basic' ? (
          <>
            <UpgradeButton plan={THE_PLAN} label={t('plans.upgradeCta')} variant="orange" icon="crown" full />
            <UpgradeButton plan={BASIC_PLAN} label={t('plans.renewCta', { plan: t('plans.basicName') })} variant="line" icon="card" full />
          </>
        ) : (
          // A trial, or no plan: both plans side by side on the plans page.
          <LinkBtn title={t('trial.seePlans')} href="/upgrade" icon="crown" className="w-full sm:w-auto sm:self-start" />
        )}
        {/* No cancel button, because there is nothing to cancel: plans are
            paid once and never auto-charge. Offering "Cancel subscription"
            would imply a recurring charge that does not exist, and worry
            people into cancelling something imaginary. It comes back when
            auto-renew does. */}
        {tier === 'premium' || tier === 'basic' ? (
          <p className="text-[13px] leading-[1.6] text-ink2 rtl:leading-[1.9]">{t('account.noAutoCharge')}</p>
        ) : null}
      </div>

      <Card flat className="mt-4 py-0">
        <Item href="/account/payments" title={t('account.paymentHistory')} icon="card" last />
      </Card>

    </Page>
  );
}
