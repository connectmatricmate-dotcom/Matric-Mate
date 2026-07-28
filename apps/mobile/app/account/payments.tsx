import { useMemo } from 'react';
import { router } from 'expo-router';
import { Btn, Card, Empty, Header, Item, Pill, Screen, Small, Spacer, useToast } from '../../src/components/ui';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { S } from '../../src/theme';

export default function Payments() {
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
    <Screen>
      <Header title={t('account.paymentsTitle')} back />
      {receipts.length === 0 ? (
        <Empty
          emoji="🧾"
          title={t('account.noPaymentsTitle')}
          sub={t('account.noPaymentsBody')}
          cta={<Btn title={t('paywall.title')} sm onPress={() => router.push('/paywall')} />}
        />
      ) : (
        <Card flat style={{ paddingVertical: 0 }}>
          {receipts.map((r, i) => (
            <Item
              key={r.id}
              title={t('account.receiptLine', { amount: r.amount.toLocaleString() })}
              sub={`${new Date(r.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · ${r.method}`}
              icon="card"
              last={i === receipts.length - 1}
              onPress={() => toast(t('pay.receipt', { ref: state.premium.ref ?? 'SP-000000' }))}
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
