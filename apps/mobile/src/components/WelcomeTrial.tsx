import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AI_QUOTA, formatDate, subjectById, subjectName } from '@matricmate/core';
import type { IconName } from '@matricmate/core';
import { useLang, useT } from '../i18n';
import type { StringKey } from '../i18n';
import { useApp } from '../store/app';
import { C, F, S } from '../theme';
import { Icon } from './Icon';
import { Btn, Card, H3, Row, Small, Spacer, Text } from './ui';

const TIPS: [IconName, StringKey][] = [
  ['book', 'welcomeTrial.tipStudy'],
  ['target', 'welcomeTrial.tipPractice'],
  ['spark', 'welcomeTrial.tipAi'],
];

const seenKey = (userId: string) => `mm.welcomeTrial.${userId}`;

/**
 * The first thing on the dashboard after the free trial starts: that it has,
 * which subject it opens and until when, and the three places worth knowing.
 * Once per account on this phone, gone at "Got it" or at the first "Start".
 *
 * Only on a trial: a student whose plan was switched on by hand has had
 * nothing start, and would read "your free trial is on" as a mistake.
 */
export function WelcomeTrial() {
  const t = useT();
  const { lang } = useLang();
  const { state, derived } = useApp();
  const access = derived.access;
  const userId = state.user?.id ?? null;
  // null while the flag is read, so the card never flashes up and away.
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    AsyncStorage.getItem(seenKey(userId))
      .then((v) => alive && setSeen(v === '1'))
      .catch(() => alive && setSeen(false));
    return () => {
      alive = false;
    };
  }, [userId]);

  if (access.tier !== 'trial' || !access.trialSubject || !userId || seen !== false) return null;

  const subject = subjectName(subjectById(access.trialSubject), lang) || access.trialSubject;
  const until = access.validTill
    ? formatDate(access.validTill, lang, { weekday: 'long', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : '';
  const firstName = (state.user?.name ?? '').trim().split(/\s+/)[0] ?? '';

  const done = () => {
    setSeen(true);
    void AsyncStorage.setItem(seenKey(userId), '1').catch(() => {});
  };

  return (
    <Card tint={C.tealTint} border={C.teal} style={{ marginBottom: S.md }}>
      <H3>{t('welcomeTrial.title', { name: firstName })}</H3>
      <Spacer h={4} />
      <Text style={{ fontFamily: F.bodyBold, fontSize: 14, lineHeight: 21, color: C.ink }}>
        {t('welcomeTrial.trialOn', { subject, date: until })}
      </Text>
      <Spacer h={S.md} />
      <View style={{ gap: S.sm }}>
        {TIPS.map(([icon, key]) => (
          <Row key={key} gap={S.sm} style={{ alignItems: 'flex-start' }}>
            <Icon name={icon} size={17} color={C.teal} />
            <Small style={{ flex: 1, color: C.ink2 }}>{t(key, { n: AI_QUOTA.trial })}</Small>
          </Row>
        ))}
      </View>
      <Spacer h={S.md} />
      <Btn
        title={t('welcomeTrial.start', { subject })}
        onPress={() => {
          done();
          router.push({ pathname: '/learn/subject/[id]', params: { id: access.trialSubject as string } });
        }}
      />
      <Spacer h={S.sm} />
      <Btn title={t('welcomeTrial.dismiss')} variant="line" sm onPress={done} />
    </Card>
  );
}
