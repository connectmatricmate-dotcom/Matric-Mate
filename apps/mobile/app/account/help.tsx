import { useState } from 'react';
import { Text, View } from 'react-native';
import { Body, Btn, Card, Header, Screen, SectionTitle, Small, Spacer, useToast } from '../../src/components/ui';
import { Icon } from '../../src/components/Icon';
import { useT } from '../../src/i18n';
import type { StringKey } from '../../src/i18n';
import { C, F, S } from '../../src/theme';

const FAQ: [StringKey, StringKey][] = [
  ['account.faq1Q', 'account.faq1A'],
  ['account.faq2Q', 'account.faq2A'],
  ['account.faq3Q', 'account.faq3A'],
  ['account.faq4Q', 'account.faq4A'],
];

export default function Help() {
  const t = useT();
  const toast = useToast();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Screen>
      <Header title={t('account.helpTitle')} back />

      <Btn title={t('account.whatsapp')} variant="whatsapp" icon="whatsapp" onPress={() => toast(t('account.whatsappToast'))} />

      <SectionTitle>{t('account.commonQuestions')}</SectionTitle>
      <View style={{ gap: S.sm }}>
        {FAQ.map(([q, a], i) => (
          <Card key={q} flat onPress={() => setOpen(open === i ? null : i)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
              <Text style={{ flex: 1, fontFamily: F.bodyBold, fontSize: 13.5, lineHeight: 20, color: C.ink }}>{t(q)}</Text>
              <Icon name={open === i ? 'close' : 'plus'} size={16} color={C.ink3} />
            </View>
            {open === i ? <Body style={{ marginTop: 8, fontSize: 13.5, color: C.ink2 }}>{t(a)}</Body> : null}
          </Card>
        ))}
      </View>

      <SectionTitle>{t('account.stillStuck')}</SectionTitle>
      <Btn title={t('account.reportProblem')} variant="line" onPress={() => toast(t('account.reportToast'))} />
      <Spacer h={S.md} />
      <Small>{t('account.replyTime')}</Small>
    </Screen>
  );
}
