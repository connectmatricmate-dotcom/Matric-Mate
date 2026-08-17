'use client';

import { formatDate, type StringKey } from '@matricmate/core';
import { UpgradeButton } from '@/components/commerce/UpgradeButton';
import { Page, PageHead } from '@/components/app/Page';
import { ItemButton } from '@/components/ui/controls';
import { Card, Empty, Icon, Item, LinkBtn, Pill } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { planName } from '@/lib/plans';
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

/** The status in the student's language. It used to print the column value. */
const STATUS: Record<string, StringKey> = {
  paid: 'account.paidLabel',
  pending: 'account.statusPending',
  failed: 'account.statusFailed',
  refunded: 'account.statusRefunded',
  cancelled: 'account.statusCancelled',
};

export function PaymentsView({ rows, failed }: { rows: PaymentRow[]; failed?: boolean }) {
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();

  const copyRef = (ref: string | null) => {
    if (!ref) return;
    void navigator.clipboard?.writeText(ref).then(
      () => toast(t('account.referenceCopied')),
      () => toast(t('states.errorTitle')),
    );
  };

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
          cta={<UpgradeButton sm variant="line" />}
        />
      ) : (
        <Card flat className="py-0">
          {rows.map((r, i) => {
            const body = {
              title: t('account.receiptLine', { amount: (r.amount ?? 0).toLocaleString() }),
              /*
               * The footnote tells students to quote the reference to support,
               * so it has to be on the row where it can be read and copied. It
               * used to appear in a two-second toast: gone before anyone could
               * write it down, and invisible to anyone who never thought to tap
               * a receipt. The Android app already fixed this.
               */
              sub: [
                `${formatDate(r.at, lang, { day: 'numeric', month: 'short', year: 'numeric' })} · ${planName(r.plan ?? 'monthly', lang)}`,
                r.reference ? t('checkout.reference', { ref: r.reference }) : null,
              ]
                .filter(Boolean)
                .join('\n'),
              icon: 'card' as const,
              last: i === rows.length - 1,
              right: (
                <Pill tone={TONE[r.status as keyof typeof TONE] ?? 'grey'}>
                  {STATUS[r.status] ? t(STATUS[r.status]) : r.status}
                </Pill>
              ),
            };
            // A payment that never completed has no reference to copy, so it
            // is a plain row rather than a button that does nothing.
            return r.reference ? (
              <ItemButton key={r.id} {...body} onClick={() => copyRef(r.reference)} />
            ) : (
              <Item key={r.id} {...body} />
            );
          })}
        </Card>
      )}

      <p className="mt-4 text-[13px] text-ink2">{t('account.paymentsFootnote')}</p>
    </Page>
  );
}
