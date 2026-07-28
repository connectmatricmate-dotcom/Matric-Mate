import { useMemo } from 'react';
import { router } from 'expo-router';
import { Btn, Card, Empty, Header, Item, Pill, Screen, Small, Spacer, useToast } from '../../src/components/ui';
import { useApp } from '../../src/store/app';
import { S } from '../../src/theme';

export default function Payments() {
  const { state } = useApp();
  const toast = useToast();

  /** Receipts are derived from the payment notifications this demo records. */
  const receipts = useMemo(
    () =>
      state.notifications
        .filter((n) => n.kind === 'payment')
        .map((n) => ({ id: n.id, at: n.at, amount: 1000, method: 'JazzCash' })),
    [state.notifications]
  );

  return (
    <Screen>
      <Header title="Payment history" back />
      {receipts.length === 0 ? (
        <Empty
          emoji="🧾"
          title="No payments yet"
          sub="Receipts appear here after your first Premium payment."
          cta={<Btn title="See Premium" sm onPress={() => router.push('/paywall')} />}
        />
      ) : (
        <Card flat style={{ paddingVertical: 2 }}>
          {receipts.map((r, i) => (
            <Item
              key={r.id}
              title={`Rs ${r.amount.toLocaleString()} — Premium`}
              sub={`${new Date(r.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · ${r.method}`}
              icon="card"
              last={i === receipts.length - 1}
              onPress={() => toast(`Receipt ${state.premium.ref ?? 'SP-000000'} — tap to share in the live app`)}
              right={<Pill tone="green">Paid</Pill>}
            />
          ))}
        </Card>
      )}
      <Spacer h={S.md} />
      <Small>Every receipt carries a Safepay reference you can quote to support.</Small>
    </Screen>
  );
}
