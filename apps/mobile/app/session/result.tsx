import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Btn, Card, H2, Pill, Ring, Row, Screen, ScriptText, Small, Spacer, Text } from '../../src/components/ui';
import { Confetti, Pop } from '../../src/components/celebration';
import { cheer } from '../../src/core/haptics';
import { Icon } from '../../src/components/Icon';
import { accuracy, grade, level, xpForAttempt } from '@matricmate/core';
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
  /* As the website marks it: a practice set ended early is marked on what was
     answered, so three right out of three tried is not 3/10 and an F, and the
     two apps no longer record the same set two different ways. A timed paper
     counts every question, answered or not, the way a real one does. */
  const total = s ? (s.mode === 'exam' ? s.mcqs.length : answers.length) : 0;
  const pct = total ? Math.round((score / total) * 100) : 0;

  /* Through core's own rule, so the figure shown here is exactly what the
     store credits and what a later recompute rebuilds. */
  const xp = useMemo(
    () => answers.reduce((n, a) => n + xpForAttempt({ ...a, mode: s?.mode ?? 'practice' }), 0),
    [answers, s?.mode],
  );

  useEffect(() => {
    // Nothing answered is not a result: it would sit on the Practice tab as 0/0.
    if (!s || !total || saved.current) return;
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

  /**
   * The average this session is compared with: the answers from before it.
   * Counting the session's own answers pulled the average towards the score,
   * so the very first session always read "+0% vs your average". Null when
   * there is no earlier answer, and then there is nothing to compare with.
   */
  const earlier = state.attempts.filter((a) => a.at < (s?.startedAt ?? 0));
  const myAverage = earlier.length ? accuracy(earlier) : null;
  /**
   * The topic most of the wrong answers came from, and the chapter to study
   * it in: the chapter of a question on that topic. "Study it now" used to
   * open the first question's chapter, which in a mixed set is often another
   * chapter entirely, and for a generated question with no chapter it opened
   * /learn/chapter/undefined.
   */
  const weakest = useMemo(() => {
    const wrong = answers
      .filter((a) => !a.correct)
      .map((a) => s?.mcqs.find((m) => m.id === a.mcqId))
      .filter((m): m is NonNullable<typeof m> => !!m?.topic?.trim());
    const counts = new Map<string, number>();
    wrong.forEach((m) => counts.set(m.topic, (counts.get(m.topic) ?? 0) + 1));
    const topic = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!topic) return null;
    const chapterId = wrong.find((m) => m.topic === topic && m.chapterId)?.chapterId ?? s?.chapterId ?? '';
    return { topic, chapterId };
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
  const diff = myAverage === null ? null : pct - myAverage;
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
        {diff !== null ? (
          <Pop delay={600}>
            <Pill tone="grey">{t('session.vsAverage', { n: `${diff >= 0 ? '+' : ''}${diff}` })}</Pill>
          </Pop>
        ) : null}
      </Row>

      {weakest ? (
        <>
          <Spacer h={S.lg} />
          <Card flat tint={C.redTint} border={C.red}>
            {/* The line names a topic, which is Urdu on an Urdu-medium account. */}
            <ScriptText text={t('session.weakSpot', { topic: weakest.topic })} face="bodyBold" size={13.5} color={C.red} />
            <Small style={{ marginTop: 2 }}>{t('session.weakSpotSub')}</Small>
            {weakest.chapterId ? (
              <>
                <Spacer h={S.md} />
                <Btn
                  title={t('session.studyNow')}
                  variant="danger"
                  sm
                  // The chapter already underneath when the set was opened
                  // from it, instead of a second copy stacked over it.
                  onPress={() => router.dismissTo(`/learn/chapter/${weakest.chapterId}`)}
                />
              </>
            ) : null}
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
            // Back to where the set was started: see session.leave.
            onPress={() => session.leave()}
          />
        </View>
      </Row>
      <Spacer h={S.md} />
      <Small style={{ textAlign: 'center' }}>{t('session.resultFootnote')}</Small>
    </Screen>
  );
}
