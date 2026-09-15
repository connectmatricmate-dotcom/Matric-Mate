import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { formatDate, subjectById, subjectName } from '@matricmate/core';
import { Icon } from '../src/components/Icon';
import { Btn, Card, H2, Header, IconButton, Screen, Small, Spacer } from '../src/components/ui';
import { useLang, useT } from '../src/i18n';
import { useApp } from '../src/store/app';
import { useAuth } from '../src/store/auth';
import { C, S } from '../src/theme';

/**
 * Where a student lands when their free trial or their plan has ended.
 *
 * It says what happened and nothing about buying. Google Play forbids an app
 * from leading anyone to pay outside Play, by link, button or instruction,
 * and Pakistan is not in any programme that allows it (core/billing.ts). How
 * to continue reaches the student outside the app: the reminder emails, the
 * website, their teacher.
 *
 * What it can do is check again, which is the whole way back: a plan made
 * active on the website, or by hand, is invisible to this phone until it
 * re-reads the server. The app also re-reads every time it comes to the front.
 */
export default function Paused() {
  const t = useT();
  const { lang } = useLang();
  const { state } = useApp();
  const { refresh, checking } = useAuth();
  const [asked, setAsked] = useState(false);
  const premium = state.premium;

  // Back to the app the moment there is a plan again, and to the trial if the
  // account turns out to be able to start one.
  useEffect(() => {
    if (premium.active) router.replace('/(tabs)');
    else if (premium.trialState === 'eligible') router.replace('/trial');
  }, [premium.active, premium.trialState]);

  const wasTrial = premium.plan === 'trial';
  const subject = premium.trialSubject ? subjectName(subjectById(premium.trialSubject), lang) || premium.trialSubject : '';
  const ended = premium.validTill ? formatDate(premium.validTill, lang, { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  const title = wasTrial ? t('paused.trialTitle') : premium.plan && ended ? t('paused.planTitle') : t('paused.noneTitle');
  const body = wasTrial
    ? subject
      ? t('paused.trialBody', { subject })
      : t('paused.trialBodyNoSubject')
    : premium.plan && ended
      ? t('paused.planBody', { date: ended })
      : t('paused.noneBody');

  async function checkAgain() {
    setAsked(false);
    await refresh();
    // Still here means still not active; the effect above handles the rest.
    setAsked(true);
  }

  return (
    <Screen>
      <Header right={<IconButton icon="gear" tone="card" onPress={() => router.push('/account')} />} />
      <View style={{ alignItems: 'center', marginTop: S.xl }}>
        <View
          style={{
            width: 76,
            height: 76,
            borderRadius: 99,
            backgroundColor: C.tealTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="clock" size={34} color={C.teal} strokeWidth={2} />
        </View>
        <Spacer h={S.lg} />
        <H2 style={{ textAlign: 'center' }}>{title}</H2>
        <Spacer h={6} />
        <Small style={{ textAlign: 'center' }}>{body}</Small>
      </View>

      <Card flat tint={C.tealTint} style={{ marginTop: S.xl }}>
        <Small style={{ color: C.ink2 }}>{t('paused.saved')}</Small>
      </Card>

      <Spacer h={S.xl} />
      <Btn title={checking ? t('access.checking') : t('billing.checkAgain')} icon="refresh" loading={checking} onPress={() => void checkAgain()} />
      {asked && !checking && !premium.active ? (
        <Small style={{ textAlign: 'center', marginTop: S.sm }}>{t('paused.stillInactive')}</Small>
      ) : null}
      <Spacer h={S.md} />
      <Btn title={t('paused.help')} variant="line" icon="help" onPress={() => router.push('/account/help')} />
    </Screen>
  );
}
