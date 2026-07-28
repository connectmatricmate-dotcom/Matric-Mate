import { useState } from 'react';
import { Text, View } from 'react-native';
import { Body, Btn, Card, Header, Screen, SectionTitle, Small, Spacer, Tap, useToast } from '../../src/components/ui';
import { Icon } from '../../src/components/Icon';
import { C, F, S } from '../../src/theme';

const FAQ = [
  ['How do I renew Premium?', 'Profile → Subscription → Renew now. JazzCash, EasyPaisa or card — Rs 1,000 for a month.'],
  ['Does it work offline?', 'Downloaded chapters, audio and MCQs work without internet. The AI tutor and timed exams need a connection.'],
  ['Why is the AI limited per day?', 'Quotas keep MatricMate affordable. Premium gets 20 questions a day, free mode gets 5.'],
  ['Can my parents see my progress?', 'Yes — share your monthly report card from Progress → Report card. They don’t need an account.'],
];

export default function Help() {
  const toast = useToast();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Screen>
      <Header title="Help & support" back />

      <Btn
        title="Chat on WhatsApp · 10am–10pm"
        variant="whatsapp"
        icon="whatsapp"
        onPress={() => toast('Opens WhatsApp with the support number in the live app')}
      />

      <SectionTitle>Common questions</SectionTitle>
      <View style={{ gap: S.sm }}>
        {FAQ.map(([q, a], i) => (
          <Card key={q} flat onPress={() => setOpen(open === i ? null : i)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
              <Text style={{ flex: 1, fontFamily: F.bodyBold, fontSize: 13.5, color: C.ink }}>{q}</Text>
              <Icon name={open === i ? 'close' : 'plus'} size={16} color={C.ink3} />
            </View>
            {open === i ? <Body style={{ marginTop: 6, fontSize: 13.5, color: C.ink2 }}>{a}</Body> : null}
          </Card>
        ))}
      </View>

      <SectionTitle>Still stuck?</SectionTitle>
      <Btn title="Report a problem" variant="line" onPress={() => toast('Problem report form ships with M5')} />
      <Spacer h={S.md} />
      <Small>Average reply time in the live app: under two hours during support hours.</Small>
    </Screen>
  );
}
