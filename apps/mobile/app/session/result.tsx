import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Btn, Card, H2, Pill, Ring, Row, Screen, ScriptText, Small, Spacer } from '../../src/components/ui';
import { Confetti, Pop } from '../../src/components/celebration';
import { cheer } from '../../src/core/haptics';
import { Icon } from '../../src/components/Icon';
import { XP, accuracy, grade , chapterById, level } from '@matricmate/core';
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
    if (pct >= 70) cheer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  /**
   * 1 to 3 stars, the scale a nine-year-old already understands: one for
   * finishing, two for a pass, three for excellent. Zero would just be mean.
   */
  const stars = pct >= 90 ? 3 : pct >= 70 ? 2 : 1;
  // The XP for this session is already in state.xp by the time this screen
  // renders, so the level before it is the level at (xp - earned).
  const levelledUp = level(state.xp) > level(Math.max(0, state.xp - xp));

  return (
    <Screen>
      {good ? <Confetti /> : null}
      <Spacer h={S.xl} />
      <View style={{ alignItems: 'center' }}>
        <Ring pct={shown} size={150} stroke={12} color={good ? C.orange : C.red}>
          <Text style={{ fontFamily: F.display, fontSize: 30, color: C.ink }}>{shown}%</Text>
          <Small style={{ fontFamily: F.bodyBold }}>
            {score} / {total}
          </Small>
        </Ring>

        {/* The reveal beat: stars land one at a time, after the ring fills. */}
        <Row gap={6} style={{ marginTop: S.md }}>
          {[0, 1, 2].map((i) => (
            <Pop key={i} delay={500 + i * 220}>
              <Icon name="star" size={30} color={i < stars ? '#F7C948' : C.grey} fill={i < stars ? '#F7C948' : C.grey} />
            </Pop>
          ))}
        </Row>

        <H2 style={{ marginTop: S.sm, textAlign: 'center' }}>
          {good
            ? t('session.resultGood', { name: (state.user?.name ?? t('common.student')).split(' ')[0] })
            : t('session.resultTry')}
        </H2>
        <Small style={{ textAlign: 'center' }}>{s.label}</Small>
      </View>

      {levelledUp ? (
        <Pop delay={1000}>
          <Spacer h={S.md} />
          <Card flat tint={C.orangeTint} border={C.orange} style={{ alignItems: 'center', paddingVertical: 12 }}>
            <Text style={{ fontFamily: F.display, fontSize: 17, color: C.orangeDark }}>
              {t('session.levelUp', { n: level(state.xp) })}
            </Text>
          </Card>
        </Pop>
      ) : null}

      <Spacer h={S.md} />
      <Row gap={S.sm} style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
        <Pop delay={300}>
          <Pill tone={good ? 'green' : 'red'}>{t('session.grade', { g: grade(pct) })}</Pill>
        </Pop>
        <Pop delay={450}>
          <Pill tone="orange">
            {s.mode === 'exam' ? t('session.xpDoubled', { n: xp }) : t('session.xpEarned', { n: xp })}
          </Pill>
        </Pop>
        <Pop delay={600}>
          <Pill tone="grey">{t('session.vsAverage', { n: `${diff >= 0 ? '+' : ''}${diff}` })}</Pill>
        </Pop>
      </Row>

      {weakest ? (
        <>
          <Spacer h={S.lg} />
          <Card flat tint={C.redTint} border={C.red}>
            {/* The line names a topic, which is Urdu on an Urdu-medium account. */}
            <ScriptText text={t('session.weakSpot', { topic: weakest })} face="bodyBold" size={13.5} color={C.red} />
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
