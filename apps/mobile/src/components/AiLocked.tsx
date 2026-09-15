import { View } from 'react-native';
import { router } from 'expo-router';
import type { StringKey } from '@matricmate/core';
import { useAsync } from '../core/useAsync';
import { useT } from '../i18n';
import { supabase } from '../lib/supabase';
import { useApp } from '../store/app';
import { C, S } from '../theme';
import { AppHeader } from './AppHeader';
import { Icon } from './Icon';
import { Body, Btn, Card, H2, Header, Screen, Spacer } from './ui';

/**
 * What an AI screen shows on the Basic plan, in place of the screen: that AI
 * is not in the student's plan, and what the plan does open. Nothing about
 * another plan or where to get it, which Google Play would read as leading
 * the student to pay outside Play (core/billing.ts). The website's AiLocked
 * can say more.
 *
 * Basic has every chapter and practice set and no AI, so this is not an
 * error. The server refuses these features to Basic in any case
 * (lib/ai/guard.ts on the website); this says so before a question is typed.
 *
 * `tabbed` for the tutor tab, which keeps the header every tab root has;
 * anything pushed gets a back header with the screen's own title.
 */
export function AiLocked({ tabbed, titleKey = 'tutor.title', chats }: { tabbed?: boolean; titleKey?: StringKey; chats?: boolean }) {
  const t = useT();
  const { state } = useApp();
  /*
   * `chats`: the tutor's own screens. Chats saved on an earlier plan are the
   * student's, and reading one costs nothing, so they stay a tap away (read
   * only; see the chat screen). Offered only when there is one to read.
   */
  const saved = useAsync<boolean>(async () => {
    if (!chats) return false;
    const { data } = await supabase.from('chat_threads').select('id').limit(1);
    return !!data?.length;
  }, [chats ? 1 : 0, state.user?.id ?? '']);
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
        <H2 style={{ textAlign: 'center' }}>{t('access.aiTitle')}</H2>
        <Spacer h={S.sm} />
        <Body style={{ textAlign: 'center', color: C.ink2 }}>{t('access.aiBody')}</Body>
      </Card>
      {saved.data ? (
        <>
          <Spacer h={S.md} />
          {/* Cast as elsewhere: the generated route list can lag a new route. */}
          <Btn title={t('tutor.viewAllChats')} variant="line" icon="spark" onPress={() => router.push('/tutor/chats' as never)} />
        </>
      ) : null}
    </Screen>
  );
}
