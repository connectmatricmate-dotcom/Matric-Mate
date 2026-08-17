import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { SUPPORT_EMAIL } from '@matricmate/core';
import { Body, Btn, Card, Header, Screen, SectionTitle, Small, Spacer, useToast } from '../../src/components/ui';
import { Icon } from '../../src/components/Icon';
import { useT } from '../../src/i18n';
import type { StringKey } from '../../src/i18n';
import { C, F, S, rowDir } from '../../src/theme';

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

  const mail = async (subject?: string) => {
    try {
      await Linking.openURL(`mailto:${SUPPORT_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`);
    } catch {
      toast(t('common.openLinkError'));
    }
  };

  return (
    <Screen>
      <Header title={t('account.helpTitle')} back />

      {/* The WhatsApp button is parked until the client provides the business
          number (docs/CLIENT-ACTIONS.md). A button that only toasts teaches
          students that buttons here do nothing. */}

      <Btn title={t('account.emailUs', { email: SUPPORT_EMAIL })} icon="mail" onPress={() => mail()} />

      <SectionTitle>{t('account.commonQuestions')}</SectionTitle>
      <View style={{ gap: S.sm }}>
        {FAQ.map(([q, a], i) => (
          <Card key={q} flat onPress={() => setOpen(open === i ? null : i)}>
            <View style={{ flexDirection: rowDir(), alignItems: 'center', gap: S.sm }}>
              <Text style={{ flex: 1, fontFamily: F.bodyBold, fontSize: 13.5, lineHeight: 20, color: C.ink }}>{t(q)}</Text>
              <Icon name={open === i ? 'close' : 'plus'} size={16} color={C.ink3} />
            </View>
            {open === i ? <Body style={{ marginTop: 8, fontSize: 13.5, color: C.ink2 }}>{t(a)}</Body> : null}
          </Card>
        ))}
      </View>

      <SectionTitle>{t('account.stillStuck')}</SectionTitle>
      <Btn
        title={t('account.reportProblem')}
        variant="line"
        // A real mail draft, as the toast copy always claimed.
        onPress={() => mail('MatricMate: problem report')}
      />
      <Spacer h={S.md} />
      <Small>{t('account.replyTime')}</Small>
    </Screen>
  );
}
