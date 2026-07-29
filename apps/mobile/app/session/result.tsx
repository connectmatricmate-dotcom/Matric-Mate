import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Btn, Card, H2, Pill, Ring, Row, Screen, Small, Spacer } from '../../src/components/ui';
import { XP, accuracy, grade , chapterById } from '@matricmate/core';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { session } from '../../src/store/session';
import { C, F, S } from '../../src/theme';

export default function Result() {
  const { state, actions } = useApp();
  const t = useT();
  const s = session.current;
  const saved = useRef(false);
  const [shown, setShown] = useState(0);

  const answers = useMemo(() => (s ? Object.values(s.answers) : []), [s]);
  const score = answers.filter((a) => a.correct).length;
  const total = s?.mcqs.length ?? 0;
  const pct = total ? Math.round((score / total) * 100) : 0;

  const xp = useMemo(() => {
    const base = answers.reduce((n, a) => n + XP.forAnswer(a.correct, a.confidence), 0);
    return s?.mode === 'exam' ? base * XP.examMultiplier : base;
  }, [answers, s?.mode]);

  useEffect(() => {
    if (!s || saved.current) return;
    saved.current = true;
    actions.addResult({
      subjectId: s.subjectId,
      chapterId: s.chapterId,
      label: s.label,
      score,
      total,
      xp,
      mode: s.mode,
      attemptIds: [],
    });
  }, [s]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let n = 0;
    const timer = setInterval(() => {
      n += Math.max(1, Math.round(pct / 18));
      if (n >= pct) {
        n = pct;
        clearInterval(timer);
      }
      setShown(n);
    }, 24);
    return () => clearInterval(timer);
  }, [pct]);

  const myAverage = accuracy(state.attempts);
  const weakest = useMemo(() => {
    const topics = answers
      .filter((a) => !a.correct)
      .map((a) => s?.mcqs.find((m) => m.id === a.mcqId)?.topic)
      .filter(Boolean) as string[];
    const counts = new Map<string, number>();
    topics.forEach((topic) => counts.set(topic, (counts.get(topic) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }, [answers, s]);

  if (!s) {
    return (
      <Screen>
        <Card flat style={{ marginTop: S.xl, alignItems: 'center', gap: S.md }}>
          <H2>{t('session.noSession')}</H2>
          <Small>{t('session.noSessionBody')}</Small>
          <Btn title={t('session.setUpSession')} sm onPress={() => router.replace('/session/setup')} />
        </Card>
      </Screen>
    );
  }

  const good = pct >= 70;
  const diff = pct - myAverage;

  return (
    <Screen>
      <Spacer h={S.xl} />
      <View style={{ alignItems: 'center' }}>
        <Ring pct={shown} size={150} stroke={12} color={good ? C.orange : C.red}>
          <Text style={{ fontFamily: F.display, fontSize: 30, color: C.ink }}>{shown}%</Text>
          <Small style={{ fontFamily: F.bodyBold }}>
            {score} / {total}
          </Small>
        </Ring>
        <H2 style={{ marginTop: S.md, textAlign: 'center' }}>
          {good
            ? t('session.resultGood', { name: (state.user?.name ?? 'Student').split(' ')[0] })
            : t('session.resultTry')}
        </H2>
        <Small style={{ textAlign: 'center' }}>{s.label}</Small>
      </View>

      <Spacer h={S.md} />
      <Row gap={S.sm} style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
        <Pill tone={good ? 'green' : 'red'}>{t('session.grade', { g: grade(pct) })}</Pill>
        <Pill tone="orange">
          {s.mode === 'exam' ? t('session.xpDoubled', { n: xp }) : t('session.xpEarned', { n: xp })}
        </Pill>
        <Pill tone="grey">{t('session.vsAverage', { n: `${diff >= 0 ? '+' : ''}${diff}` })}</Pill>
      </Row>

      {weakest ? (
        <>
          <Spacer h={S.lg} />
          <Card flat tint={C.redTint} border={C.red}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 13.5, color: C.red }}>
              {t('session.weakSpot', { topic: weakest })}
            </Text>
            <Small style={{ marginTop: 2 }}>{t('session.weakSpotSub')}</Small>
            <Spacer h={S.md} />
            <Btn
              title={t('session.studyNow')}
              variant="danger"
              sm
              onPress={() => router.replace(`/learn/chapter/${s.chapterId ?? chapterById(s.mcqs[0].chapterId)?.id}`)}
            />
          </Card>
        </>
      ) : null}

      <Spacer h={S.lg} />
      <Row gap={S.sm}>
        <View style={{ flex: 1 }}>
          <Btn title={t('session.reviewAnswers')} variant="line" onPress={() => router.replace('/session/review')} />
        </View>
        <View style={{ flex: 1 }}>
          <Btn
            title={t('common.done')}
            onPress={() => {
              session.clear();
              router.replace('/(tabs)/practice');
            }}
          />
        </View>
      </Row>
      <Spacer h={S.md} />
      <Small style={{ textAlign: 'center' }}>{t('session.resultFootnote')}</Small>
    </Screen>
  );
}
