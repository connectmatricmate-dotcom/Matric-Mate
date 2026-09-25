import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { formatDate, hasEnded, subjectById, subjectName } from '@matricmate/core';
import { Icon } from '../src/components/Icon';
import { Btn, Card, H2, H3, Header, IconButton, Row, Screen, Small, Spacer, Text } from '../src/components/ui';
import { useLang, useT } from '../src/i18n';
import { useApp } from '../src/store/app';
import { useAuth } from '../src/store/auth';
import { C, F, S, T } from '../src/theme';

/**
 * Where a student lands when their free trial or their plan has ended.
 *
 * It says what happened and how to continue, in plain words: open the website,
 * sign in with this account, choose a plan, come back and check again. No link
 * to it and no price. Google Play allows exactly that for an app that sells
 * nothing itself (core/billing.ts). This screen used to say nothing about how
 * to continue, and a student who only had the app had no way to find out.
 * The emails carry the prices and a button that signs them in.
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

  // Ended means its date has passed. A plan the admin switched off early
  // keeps a date still to come, and "it ended on" a future date is nonsense:
  // that account is simply not active.
  const endedAt = hasEnded(premium.validTill) ? premium.validTill : null;
  const wasTrial = premium.plan === 'trial' && !!endedAt;
  const subject = premium.trialSubject ? subjectName(subjectById(premium.trialSubject), lang) || premium.trialSubject : '';
  const ended = endedAt ? formatDate(endedAt, lang, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const email = state.user?.contact ?? '';
  const steps = [
    t('plansWhere.step1'),
    email ? t('plansWhere.step2', { email }) : t('plansWhere.step2NoEmail'),
    t('plansWhere.step3'),
    t('plansWhere.step4'),
  ];

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

      <Card style={{ marginTop: S.xl }}>
        <H3>{t('plansWhere.pausedTitle')}</H3>
        <Spacer h={S.sm} />
        <View style={{ gap: S.sm }}>
          {steps.map((line, i) => (
            <Row key={i} gap={S.sm} style={{ alignItems: 'flex-start' }}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: C.tealTint,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: F.bodyBold, fontSize: 12, color: C.teal }}>{i + 1}</Text>
              </View>
              {/* selectable: the address and the email can be copied by hand;
                  nothing here opens the website (core/billing.ts). */}
              <Text selectable style={[T.small, { flex: 1, color: C.ink }]}>
                {line}
              </Text>
            </Row>
          ))}
        </View>
      </Card>

      <Card flat tint={C.tealTint} style={{ marginTop: S.md }}>
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
