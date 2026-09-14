import { router } from 'expo-router';
import { View } from 'react-native';
import type { StringKey } from '@matricmate/core';
import { useT } from '../i18n';
import { C, S } from '../theme';
import { AppHeader } from './AppHeader';
import { Icon } from './Icon';
import { Body, Btn, Card, H2, Header, Screen, Spacer } from './ui';

/**
 * What an AI screen shows on the Basic plan, in place of the screen. The
 * website's AiLocked, without the price: this app may describe a plan but
 * never sell one (core/billing.ts), so the one way forward is the plans
 * screen, which says what Premium adds and where plans are managed.
 *
 * Basic has every chapter and practice set and no AI, so this is not an
 * error. The server refuses these features to Basic in any case
 * (lib/ai/guard.ts on the website); this says so before a question is typed.
 *
 * `tabbed` for the tutor tab, which keeps the header every tab root has;
 * anything pushed gets a back header with the screen's own title.
 */
export function AiLocked({ tabbed, titleKey = 'tutor.title' }: { tabbed?: boolean; titleKey?: StringKey }) {
  const t = useT();
  return (
    <Screen tabbed={tabbed}>
      {tabbed ? <AppHeader title={t('tutor.title')} eyebrow={t('tutor.sub')} showStreak={false} /> : <Header title={t(titleKey)} back />}
      <Spacer h={S.md} />
      <Card style={{ alignItems: 'center', paddingVertical: S.xxl }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 99,
            backgroundColor: C.orangeTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="spark" size={26} color={C.orangeDark} />
        </View>
        <Spacer h={S.md} />
        <H2 style={{ textAlign: 'center' }}>{t('aiLock.title')}</H2>
        <Spacer h={S.sm} />
        <Body style={{ textAlign: 'center', color: C.ink2 }}>{t('aiLock.body')}</Body>
        <Spacer h={S.lg} />
        <Btn title={t('aiLock.ctaAndroid')} variant="orange" icon="crown" onPress={() => router.push('/upgrade')} />
      </Card>
    </Screen>
  );
}
