import { formatDate } from '@matricmate/core';
import * as Clipboard from 'expo-clipboard';
import { Card, Empty, ErrorState, Header, Item, Pill, Screen, Skeleton, Small, Spacer, useToast } from '../../src/components/ui';
import { useAsync } from '../../src/core/useAsync';
import { supabase } from '../../src/lib/supabase';
import { useLang, useT } from '../../src/i18n';
import type { StringKey } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { S } from '../../src/theme';
import { View } from 'react-native';

/** A paid row from the payments table, already shaped for the list. */
type Receipt = { id: string; at: string; amount: number; plan: string | null; reference: string | null; status: string };

/**
 * Real receipts from the payments table, the same rows Safepay's webhook
 * writes when a checkout completes on the website.
 *
 * This screen used to synthesise receipts out of local notifications, which
 * nothing ever writes, with a hardcoded amount and payment method: an empty
 * list at best and a fabricated one at worst. RLS scopes the query to the
 * signed-in student's own rows.
 */
const TONE: Record<string, 'green' | 'orange' | 'red' | 'grey'> = {
  paid: 'green',
  refunded: 'grey',
};

/** The status in the student's language, never the raw column value. */
const STATUS: Record<string, StringKey> = {
  paid: 'account.paidLabel',
  refunded: 'account.statusRefunded',
};

export default function Payments() {
  const { state } = useApp();
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();

  const userId = state.user?.id ?? null;
  const { data: receipts, loading, error, reload } = useAsync(async (): Promise<Receipt[]> => {
    if (!userId) return [];
    const { data, error: qErr } = await supabase
      .from('payments')
      .select('id,at,amount,plan,reference,status')
      .eq('user_id', userId)
      // Receipts only: payments that went through (and any since refunded).
      // A checkout that failed or was never finished is the website's to
      // show; listed in this app it read as a purchase flow Play does not
      // allow here. The website's history keeps every attempt.
      .in('status', ['paid', 'refunded'])
      .order('at', { ascending: false })
      .limit(24);
    if (qErr) throw qErr;
    return (data ?? []) as Receipt[];
  }, [userId]);

  return (
    <Screen>
      <Header title={t('account.paymentsTitle')} back />
      {loading ? (
        <View style={{ gap: S.sm }}>
          <Skeleton h={56} />
          <Skeleton h={56} />
        </View>
      ) : error ? (
        <ErrorState title={t('states.errorTitle')} sub={t('states.errorBody')} retry={t('common.retry')} onRetry={reload} />
      ) : !receipts || receipts.length === 0 ? (
        <Empty emoji="🧾" title={t('account.noReceiptsTitle')} sub={t('account.noReceiptsBody')} />
      ) : (
        <Card flat style={{ paddingVertical: 0 }}>
          {receipts.map((r, i) => (
            <Item
              key={r.id}
              // The plan the payment was for, since there are two. No amount:
              // the app names no price anywhere (core/billing.ts).
              title={t(r.plan === 'basic' ? 'billing.planBasic' : 'billing.premium')}
              // The footnote tells students to quote the reference to support,
              // so it has to be on the row, readable. It used to live in a
              // two-second toast: gone before anyone could write it down, and
              // invisible to anyone who never thought to tap a receipt.
              sub={[
                formatDate(r.at, lang, { day: 'numeric', month: 'short', year: 'numeric' }),
                r.reference ? t('checkout.reference', { ref: r.reference }) : null,
              ]
                .filter(Boolean)
                .join('\n')}
              icon="card"
              last={i === receipts.length - 1}
              onPress={
                r.reference
                  ? () => {
                      void Clipboard.setStringAsync(r.reference as string);
                      toast(t('account.referenceCopied'));
                    }
                  : undefined
              }
              right={<Pill tone={TONE[r.status] ?? 'grey'}>{STATUS[r.status] ? t(STATUS[r.status]) : r.status}</Pill>}
            />
          ))}
        </Card>
      )}
      <Spacer h={S.md} />
      <Small>{t('account.paymentsFootnote')}</Small>
    </Screen>
  );
}
