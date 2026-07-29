'use client';

import { useEffect, useState } from 'react';
import { Page, PageHead } from '@/components/app/Page';
import { ItemButton } from '@/components/ui/controls';
import { Card, Empty, LinkBtn, Pill, Skeleton } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { planById } from '@/lib/plans';
import { createClient } from '@/lib/supabase/client';
import { useT } from '@/lib/store';

/**
 * Real payment history, straight from the payments table.
 *
 * Every checkout writes a row before the student leaves for the gateway, and
 * the webhook or the gateway confirm moves it to paid, so this is the same
 * ledger support would read. RLS scopes the query to the signed-in student's
 * own rows; it needs no user id and cannot fetch anyone else's.
 */

type PaymentRow = {
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

export function PaymentsView() {
  const t = useT();
  const toast = useToast();
  const [rows, setRows] = useState<PaymentRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    createClient()
      .from('payments')
      .select('id, plan, amount, status, reference, at')
      .order('at', { ascending: false })
      .then(({ data }) => {
        if (alive) setRows((data as PaymentRow[]) ?? []);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Page width="focus">
      <PageHead back="/account" backLabel={t('account.title')} title={t('account.paymentsTitle')} />

      {rows === null ? (
        <Card flat className="flex flex-col gap-3">
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
        </Card>
      ) : rows.length === 0 ? (
        <Empty
          emoji="🧾"
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
              sub={`${new Date(r.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · ${planById(r.plan ?? 'monthly').name}`}
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
