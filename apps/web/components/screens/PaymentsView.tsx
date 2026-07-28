'use client';

import { useMemo } from 'react';
import { Page, PageHead } from '@/components/app/Page';
import { ItemButton } from '@/components/ui/controls';
import { Card, Empty, LinkBtn, Pill } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { useApp, useT } from '@/lib/store';

export function PaymentsView() {
  const { state } = useApp();
  const t = useT();
  const toast = useToast();

  const receipts = useMemo(
    () =>
      state.notifications
        .filter((n) => n.kind === 'payment')
        .map((n) => ({ id: n.id, at: n.at, amount: 1000, method: 'JazzCash' })),
    [state.notifications]
  );

  return (
    <Page width="focus">
      <PageHead back="/account" backLabel={t('account.title')} title={t('account.paymentsTitle')} />

      {receipts.length === 0 ? (
        <Empty
          emoji="🧾"
          title={t('account.noPaymentsTitle')}
          sub={t('account.noPaymentsBody')}
          cta={<LinkBtn title={t('account.upgrade')} href="/pricing" sm variant="line" />}
        />
      ) : (
        <Card flat className="py-0">
          {receipts.map((r, i) => (
            <ItemButton
              key={r.id}
              title={t('account.receiptLine', { amount: r.amount.toLocaleString() })}
              sub={`${new Date(r.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · ${r.method}`}
              icon="card"
              last={i === receipts.length - 1}
              right={<Pill tone="green">{t('account.paidLabel')}</Pill>}
              onClick={() => toast(t('account.lastReceipt', { ref: state.premium.ref ?? 'SP-000000' }))}
            />
          ))}
        </Card>
      )}

      <p className="mt-4 text-[13px] text-ink2">{t('account.paymentsFootnote')}</p>
    </Page>
  );
}
