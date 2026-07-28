import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon, IconName } from '../../src/components/Icon';
import { LockedNotice } from '../../src/components/LockedNotice';
import { Card, Header, Item, Pill, Row, Screen, SectionTitle, Small, Spacer } from '../../src/components/ui';
import { useT } from '../../src/i18n';
import type { StringKey } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, S } from '../../src/theme';

const PERKS: [IconName, StringKey][] = [
  ['book', 'billing.perk1'],
  ['target', 'billing.perk2'],
  ['spark', 'billing.perk3'],
  ['chart', 'billing.perk4'],
  ['download', 'billing.perk5'],
];

/**
 * Read-only. The app may show what a student's plan includes, but never sell,
 * price, or link to a purchase, see core/billing.ts.
 */
export default function Subscription() {
  const { state } = useApp();
  const t = useT();
  const active = state.premium.active;

  return (
    <Screen>
      <Header title={t('account.subscriptionTitle')} back />

      <Card border={active ? C.orange : undefined}>
        <Row gap={S.md}>
          <Text style={{ fontSize: 24 }}>{active ? '👑' : '🔓'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.ink }}>
              {active ? t('billing.statusActive') : t('billing.statusFree')}
            </Text>
            <Small>
              {active && state.premium.validTill
                ? t('billing.activeTill', {
                    date: new Date(state.premium.validTill).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    }),
                  })
                : t('billing.freeBody')}
            </Small>
          </View>
          <Pill tone={active ? 'green' : 'grey'}>{active ? t('account.active') : t('account.inactive')}</Pill>
        </Row>
      </Card>

      <SectionTitle>{t('billing.whatsIncluded')}</SectionTitle>
      <Card flat>
        <View style={{ gap: S.md }}>
          {PERKS.map(([icon, key]) => (
            <Row key={key} gap={S.md}>
              <Icon name={icon} size={18} color={active ? C.teal : C.ink3} />
              <Text style={{ flex: 1, fontFamily: F.body, fontSize: 14, lineHeight: 21, color: active ? C.ink : C.ink2 }}>
                {t(key)}
              </Text>
              {active ? <Icon name="check" size={16} color={C.green} strokeWidth={2.6} /> : null}
            </Row>
          ))}
        </View>
      </Card>

      <Spacer h={S.lg} />
      <LockedNotice variant={active ? 'locked' : 'free'} />

      <Spacer h={S.md} />
      <Card flat style={{ paddingVertical: 0 }}>
        <Item title={t('account.paymentHistory')} icon="card" last onPress={() => router.push('/account/payments')} />
      </Card>
    </Screen>
  );
}
