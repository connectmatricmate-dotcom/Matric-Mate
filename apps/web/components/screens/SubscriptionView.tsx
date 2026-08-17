'use client';

import { formatDate } from '@matricmate/core';
import { UpgradeButton } from '@/components/commerce/UpgradeButton';
/**
 * The web app is the only surface where a subscription can be started, renewed
 * or cancelled, the Android build shows the same status read-only, because
 * Google Play forbids it from linking to a checkout. See core/billing.ts.
 */
import type { IconName, StringKey } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { useState } from 'react';
import { Btn } from '@/components/ui/controls';
import { Card, Icon, Item, Pill, SectionTitle } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { planById, planName } from '@/lib/plans';
import { useApp, useLang, useT } from '@/lib/store';

const PERKS: [IconName, StringKey][] = [
  ['book', 'billing.perk1'],
  ['target', 'billing.perk2'],
  ['spark', 'billing.perk3'],
  ['chart', 'billing.perk4'],
  ['download', 'billing.perk5'],
];

export function SubscriptionView() {
  const { state, actions } = useApp();
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const [checking, setChecking] = useState(false);
  const active = state.premium.active;
  const plan = planById(state.premium.plan ?? 'monthly');

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
            {active ? `${t('billing.statusActive')} · ${planName(plan.id, lang)}` : t('billing.statusFree')}
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

      <SectionTitle>{t('billing.whatsIncluded')}</SectionTitle>
      <Card flat>
        <ul className="flex flex-col gap-4">
          {PERKS.map(([icon, key]) => (
            <li key={key} className="flex items-center gap-3">
              <Icon name={icon} size={18} className={`shrink-0 ${active ? 'text-teal' : 'text-ink3'}`} />
              <span className={`min-w-0 flex-1 text-[14px] leading-[1.5] ${active ? 'text-ink' : 'text-ink2'}`}>{t(key)}</span>
              {active ? <Icon name="check" size={16} strokeWidth={2.6} className="shrink-0 text-green" /> : null}
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-6 flex flex-col gap-2.5">
        {active ? (
          <>
            <UpgradeButton label={t('billing.premium')} variant="orange" icon="card" />
            {/* No cancel button, because there is nothing to cancel: plans are
                paid once and never auto-charge. Offering "Cancel subscription"
                would imply a recurring charge that does not exist, and worry
                people into cancelling something imaginary. It comes back when
                auto-renew does. */}
            <p className="text-[13px] leading-[1.6] text-ink2">{t('account.noAutoCharge')}</p>
          </>
        ) : (
          <>
            <UpgradeButton />
          </>
        )}
      </div>

      <Card flat className="mt-4 py-0">
        <Item href="/account/payments" title={t('account.paymentHistory')} icon="card" last />
      </Card>

    </Page>
  );
}
