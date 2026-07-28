import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Btn, Card, Header, Item, Pill, Row, Screen, Sheet, Small, Spacer, useToast } from '../../src/components/ui';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, S } from '../../src/theme';

export default function Subscription() {
  const { state, actions } = useApp();
  const t = useT();
  const toast = useToast();
  const [cancelOpen, setCancelOpen] = useState(false);
  const active = state.premium.active;

  return (
    <>
      <Screen>
        <Header title={t('account.subscriptionTitle')} back />

        <Card border={active ? C.orange : undefined}>
          <Row gap={S.md}>
            <Text style={{ fontSize: 24 }}>{active ? '👑' : '🔓'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.ink }}>
                {active ? t('account.planLine') : t('account.freeMode')}
              </Text>
              <Small>
                {active && state.premium.validTill
                  ? t('account.activeTill', {
                      date: new Date(state.premium.validTill).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      }),
                    })
                  : t('account.limitedAccess')}
              </Small>
            </View>
            <Pill tone={active ? 'green' : 'grey'}>{active ? t('account.active') : t('account.inactive')}</Pill>
          </Row>
          {active ? (
            <Card flat style={{ marginTop: S.md, paddingVertical: 0 }}>
              <Item
                title={t('account.paymentMethod')}
                sub={state.premium.ref ? t('account.lastReceipt', { ref: state.premium.ref }) : 'JazzCash'}
                icon="card"
                last
              />
            </Card>
          ) : null}
        </Card>

        <Spacer h={S.lg} />
        {active ? (
          <>
            <Btn title={t('account.renewNow')} variant="orange" onPress={() => router.push('/pay')} />
            <Spacer h={S.sm} />
            <Btn title={t('account.cancelSub')} variant="ghost" onPress={() => setCancelOpen(true)} />
            <Spacer h={S.sm} />
            <Small style={{ textAlign: 'center' }}>{t('account.noAutoCharge')}</Small>
          </>
        ) : (
          <Btn title={t('paywall.title')} variant="orange" onPress={() => router.push('/paywall')} />
        )}
      </Screen>

      <Sheet visible={cancelOpen} onClose={() => setCancelOpen(false)} title={t('account.cancelTitle')}>
        <Small>{t('account.cancelBody')}</Small>
        <Spacer h={S.lg} />
        <Btn
          title={t('account.cancelSub')}
          variant="danger"
          onPress={() => {
            actions.cancelSubscription();
            setCancelOpen(false);
            toast(t('account.cancelled'));
          }}
        />
        <Spacer h={S.sm} />
        <Btn title={t('account.keepPremium')} variant="ghost" onPress={() => setCancelOpen(false)} />
      </Sheet>
    </>
  );
}
