'use client';

/**
 * The web app is the only surface where a subscription can be started, renewed
 * or cancelled, the Android build shows the same status read-only, because
 * Google Play forbids it from linking to a checkout. See core/billing.ts.
 */
import { useState } from 'react';
import type { IconName, StringKey } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Btn } from '@/components/ui/controls';
import { Card, Icon, Item, LinkBtn, Pill, SectionTitle } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { useApp, useT } from '@/lib/store';

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
  const toast = useToast();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const active = state.premium.active;

  return (
    <Page width="focus">
      <PageHead back="/account" backLabel={t('account.title')} title={t('account.subscriptionTitle')} />

      <Card border={active ? 'border-orange' : undefined} className="flex items-center gap-3">
        <span className="text-[24px]">{active ? '👑' : '🔓'}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-extrabold text-ink">{active ? t('billing.statusActive') : t('billing.statusFree')}</p>
          <p className="text-[13px] text-ink2">
            {active && state.premium.validTill
              ? t('billing.activeTill', {
                  date: new Date(state.premium.validTill).toLocaleDateString('en-GB', {
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
            <LinkBtn title={t('account.renewNow')} href="/checkout" variant="orange" icon="card" />
            <Btn title={t('account.cancelSub')} variant="ghost" onClick={() => setConfirmCancel(true)} />
            <p className="text-[13px] text-ink2">{t('account.noAutoCharge')}</p>
          </>
        ) : (
          <>
            <LinkBtn title={t('account.upgrade')} href="/pricing" icon="crown" />
            <p className="text-[13px] text-ink2">{t('account.planLine')}</p>
          </>
        )}
      </div>

      <Card flat className="mt-4 py-0">
        <Item href="/account/payments" title={t('account.paymentHistory')} icon="card" last />
      </Card>

      <Sheet open={confirmCancel} onClose={() => setConfirmCancel(false)} title={t('account.cancelTitle')}>
        <p className="text-[13.5px] leading-[1.6] text-ink2">{t('account.cancelBody')}</p>
        <Btn
          title={t('account.cancelSub')}
          variant="danger"
          className="mt-5 w-full"
          onClick={() => {
            actions.cancelSubscription();
            setConfirmCancel(false);
            toast(t('account.cancelled'));
          }}
        />
        <Btn title={t('account.keepPremium')} variant="ghost" className="mt-2 w-full" onClick={() => setConfirmCancel(false)} />
      </Sheet>
    </Page>
  );
}
