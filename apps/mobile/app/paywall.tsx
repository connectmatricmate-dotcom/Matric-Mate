import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon, IconName } from '../src/components/Icon';
import { Btn, Card, H2, Header, Pill, Row, Screen, Small, Spacer } from '../src/components/ui';
import { C, F, S } from '../src/theme';

const PERKS: [IconName, string][] = [
  ['book', 'Every chapter, note and audio lesson'],
  ['target', 'Unlimited MCQs, exams and past papers'],
  ['spark', 'AI tutor — 20 questions a day'],
  ['chart', 'Weak topics and monthly report card'],
  ['download', 'Offline downloads'],
  ['bell', 'Study reminders that actually help'],
];

export default function Paywall() {
  return (
    <Screen
      footer={
        <View style={{ gap: S.sm }}>
          <Btn title="Start Premium — Rs 1,000" variant="orange" onPress={() => router.push('/pay')} />
          <Btn title="Not now — use free mode" variant="ghost" onPress={() => router.replace('/(tabs)')} />
        </View>
      }
    >
      <Header title="Go Premium" sub="Everything unlocked, one price" />

      <Card>
        <View style={{ gap: S.md }}>
          {PERKS.map(([icon, text]) => (
            <Row key={text} gap={S.md}>
              <Icon name={icon} color={C.teal} size={19} />
              <Text style={{ flex: 1, fontFamily: F.body, fontSize: 14, color: C.ink }}>{text}</Text>
            </Row>
          ))}
        </View>
      </Card>

      <Spacer h={S.md} />
      <Card border={C.orange}>
        <Pill tone="orange">First 3 days free</Pill>
        <Row style={{ alignItems: 'baseline', marginTop: S.sm }} gap={6}>
          <Text style={{ fontFamily: F.display, fontSize: 32, color: C.ink }}>Rs 1,000</Text>
          <Small style={{ fontFamily: F.bodyBold }}>/ month</Small>
        </Row>
        <Small>Cancel anytime · cards, JazzCash and EasyPaisa · no auto-charge without a reminder</Small>
      </Card>

      <Spacer h={S.md} />
      <Card flat tint={C.tealTint}>
        <Text style={{ fontFamily: F.bodyBold, fontSize: 13.5, color: C.ink }}>Free mode gives you</Text>
        <Small style={{ marginTop: 4 }}>
          Browse everything, one full chapter per subject, 5 MCQs and 5 AI questions a day.
        </Small>
      </Card>
    </Screen>
  );
}
