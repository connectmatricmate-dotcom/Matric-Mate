'use client';

import { formatDate } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { ItemButton } from '@/components/ui/controls';
import { Card, Empty, Icon, LinkBtn, Pill } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { planById } from '@/lib/plans';
import { useLang, useT } from '@/lib/store';

/**
 * Real payment history, straight from the payments table.
 *
 * Every checkout writes a row before the student leaves for the gateway, and
 * the webhook or the gateway confirm moves it to paid, so this is the same
 * ledger support would read. The page fetches the rows server-side under RLS;
 * this screen only renders them.
 */

export type PaymentRow = {
  id: string;
  plan: string | null;
  amount: number | null;
  status: string;
  reference: string | null;
  at: string;
};

const TONE = {
  paid: 'green',
  pending: 'orange',
  failed: 'red',
  refunded: 'grey',
  cancelled: 'grey',
} as const;

export function PaymentsView({ rows, failed }: { rows: PaymentRow[]; failed?: boolean }) {
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();

  return (
    <Page width="focus">
      <PageHead back="/account" backLabel={t('account.title')} title={t('account.paymentsTitle')} />

      {failed ? (
        <Card flat className="flex flex-col items-center gap-3 py-7 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-redtint text-red">
            <Icon name="alert" size={22} />
          </span>
          <p className="text-[14px] text-ink2">{t('states.errorBody')}</p>
          <LinkBtn title={t('common.retry')} href="/account/payments" sm variant="line" />
        </Card>
      ) : rows.length === 0 ? (
        <Empty
          icon="receipt"
          title={t('account.noPaymentsTitle')}
          sub={t('account.noPaymentsBody')}
          cta={<LinkBtn title={t('account.upgrade')} href="/pricing" sm variant="line" />}
        />
      ) : (
        <Card flat className="py-0">
          {rows.map((r, i) => (
            <ItemButton
              key={r.id}
              title={t('account.receiptLine', { amount: (r.amount ?? 0).toLocaleString() })}
              sub={`${formatDate(r.at, lang, { day: 'numeric', month: 'short', year: 'numeric' })} · ${planById(r.plan ?? 'monthly').name}`}
              icon="card"
              last={i === rows.length - 1}
              right={
                <Pill tone={TONE[r.status as keyof typeof TONE] ?? 'grey'}>
                  {r.status === 'paid' ? t('account.paidLabel') : r.status}
                </Pill>
              }
              onClick={() => toast(t('account.lastReceipt', { ref: r.reference ?? r.id.slice(0, 8) }))}
            />
          ))}
        </Card>
      )}

      <p className="mt-4 text-[13px] text-ink2">{t('account.paymentsFootnote')}</p>
    </Page>
  );
}
