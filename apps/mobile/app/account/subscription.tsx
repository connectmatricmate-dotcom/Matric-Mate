import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Btn, Card, Header, Item, Pill, Row, Screen, Sheet, Small, Spacer, useToast } from '../../src/components/ui';
import { useApp } from '../../src/store/app';
import { C, F, S } from '../../src/theme';

export default function Subscription() {
  const { state, actions } = useApp();
  const toast = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);
  const active = state.premium.active;

  return (
    <>
      <Screen>
        <Header title="Subscription" back />

        <Card border={active ? C.orange : undefined}>
          <Row gap={S.md}>
            <Text style={{ fontSize: 24 }}>{active ? '👑' : '🔓'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.ink }}>
                {active ? 'Premium · Rs 1,000/month' : 'Free mode'}
              </Text>
              <Small>
                {active && state.premium.validTill
                  ? `Active till ${new Date(state.premium.validTill).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  : 'Limited practice and AI questions'}
              </Small>
            </View>
            <Pill tone={active ? 'green' : 'grey'}>{active ? 'Active' : 'Inactive'}</Pill>
          </Row>
          {active ? (
            <Card flat style={{ marginTop: S.md, paddingVertical: 2 }}>
              <Item title="Payment method" sub={state.premium.ref ? `Last receipt ${state.premium.ref}` : 'JazzCash'} icon="card" last />
            </Card>
          ) : null}
        </Card>

        <Spacer h={S.lg} />
        {active ? (
          <>
            <Btn title="Renew now — Rs 1,000" variant="orange" onPress={() => router.push('/pay')} />
            <Spacer h={S.sm} />
            <Btn title="Cancel subscription" variant="ghost" onPress={() => setCancelOpen(true)} />
            <Spacer h={S.sm} />
            <Small style={{ textAlign: 'center' }}>
              No auto-charge — we send a reminder two days before expiry and you renew yourself.
            </Small>
          </>
        ) : (
          <Btn title="See Premium" variant="orange" onPress={() => router.push('/paywall')} />
        )}
      </Screen>

      <Sheet visible={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel Premium?">
        <Small>You keep access until the date you’ve already paid for. Downloads stay on your device.</Small>
        <Spacer h={S.lg} />
        <Btn
          title="Cancel Premium"
          variant="danger"
          onPress={() => {
            actions.cancelSubscription();
            setCancelOpen(false);
            toast('Premium cancelled');
          }}
        />
        <Spacer h={S.sm} />
        <Btn title="Keep Premium" variant="ghost" onPress={() => setCancelOpen(false)} />
      </Sheet>
    </>
  );
}
