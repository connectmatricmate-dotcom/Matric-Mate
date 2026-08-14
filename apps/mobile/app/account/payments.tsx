import { Card, Empty, ErrorState, Header, Item, Pill, Screen, Skeleton, Small, Spacer, useToast } from '../../src/components/ui';
import { useAsync } from '../../src/core/useAsync';
import { supabase } from '../../src/lib/supabase';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { S } from '../../src/theme';
import { View } from 'react-native';

/** A paid row from the payments table, already shaped for the list. */
type Receipt = { id: string; at: string; amount: number; plan: string | null; reference: string | null };

/**
 * Real receipts from the payments table, the same rows Safepay's webhook
 * writes when a checkout completes on the website.
 *
 * This screen used to synthesise receipts out of local notifications, which
 * nothing ever writes, with a hardcoded amount and payment method: an empty
 * list at best and a fabricated one at worst. RLS scopes the query to the
 * signed-in student's own rows.
 */
export default function Payments() {
  const { state } = useApp();
  const t = useT();
  const toast = useToast();

  const userId = state.user?.id ?? null;
  const { data: receipts, loading, error, reload } = useAsync(async (): Promise<Receipt[]> => {
    if (!userId) return [];
    const { data, error: qErr } = await supabase
      .from('payments')
      .select('id,at,amount,plan,reference,status')
      .eq('user_id', userId)
      .eq('status', 'paid')
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
        <Empty emoji="🧾" title={t('account.noPaymentsTitle')} sub={t('account.noPaymentsBody')} />
      ) : (
        <Card flat style={{ paddingVertical: 0 }}>
          {receipts.map((r, i) => (
            <Item
              key={r.id}
              title={t('billing.premium')}
              sub={`${new Date(r.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · Rs ${r.amount}`}
              icon="card"
              last={i === receipts.length - 1}
              onPress={r.reference ? () => toast(r.reference as string) : undefined}
              right={<Pill tone="green">{t('account.paidLabel')}</Pill>}
            />
          ))}
        </Card>
      )}
      <Spacer h={S.md} />
      <Small>{t('account.paymentsFootnote')}</Small>
    </Screen>
  );
}
