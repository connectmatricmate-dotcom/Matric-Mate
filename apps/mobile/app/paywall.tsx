import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon, IconName } from '../src/components/Icon';
import { Btn, Card, Header, Pill, Row, Screen, Small, Spacer } from '../src/components/ui';
import { useT } from '../src/i18n';
import type { StringKey } from '../src/i18n';
import { C, F, S } from '../src/theme';

const PERKS: [IconName, StringKey][] = [
  ['book', 'paywall.perk1'],
  ['target', 'paywall.perk2'],
  ['spark', 'paywall.perk3'],
  ['chart', 'paywall.perk4'],
  ['download', 'paywall.perk5'],
  ['bell', 'paywall.perk6'],
];

export default function Paywall() {
  const t = useT();
  return (
    <Screen
      footer={
        <View style={{ gap: S.sm }}>
          <Btn title={t('paywall.start')} variant="orange" onPress={() => router.push('/pay')} />
          <Btn title={t('paywall.notNow')} variant="ghost" onPress={() => router.replace('/(tabs)')} />
        </View>
      }
    >
      <Header title={t('paywall.title')} sub={t('paywall.sub')} />

      <Card>
        <View style={{ gap: S.md }}>
          {PERKS.map(([icon, key]) => (
            <Row key={key} gap={S.md}>
              <Icon name={icon} color={C.teal} size={19} />
              <Text style={{ flex: 1, fontFamily: F.body, fontSize: 14, lineHeight: 21, color: C.ink }}>{t(key)}</Text>
            </Row>
          ))}
        </View>
      </Card>

      <Spacer h={S.md} />
      <Card border={C.orange}>
        <Pill tone="orange">{t('paywall.trial')}</Pill>
        <Row style={{ alignItems: 'baseline', marginTop: S.sm }} gap={6}>
          <Text style={{ fontFamily: F.display, fontSize: 32, color: C.ink }}>{t('paywall.price')}</Text>
          <Small style={{ fontFamily: F.bodyBold }}>{t('paywall.perMonth')}</Small>
        </Row>
        <Small>{t('paywall.priceNote')}</Small>
      </Card>

      <Spacer h={S.md} />
      <Card flat tint={C.tealTint}>
        <Text style={{ fontFamily: F.bodyBold, fontSize: 13.5, color: C.ink }}>{t('paywall.freeTitle')}</Text>
        <Small style={{ marginTop: 4 }}>{t('paywall.freeBody')}</Small>
      </Card>
    </Screen>
  );
}
