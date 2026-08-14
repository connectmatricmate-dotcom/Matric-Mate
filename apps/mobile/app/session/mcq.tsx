import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { Body, Btn, Card, H3, Label, Pill, Row, Screen, ScriptText, Small, Spacer, Tap } from '../../src/components/ui';
import { SessionHeader } from '../../src/components/SessionHeader';
import { XP , Confidence } from '@matricmate/core';
import Animated from 'react-native-reanimated';
import { Pop, useShake } from '../../src/components/celebration';
import { thud, tick } from '../../src/core/haptics';
import { useT } from '../../src/i18n';
import type { StringKey } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { session } from '../../src/store/session';
import { C, F, S } from '../../src/theme';

const LEVELS: { value: Confidence; label: StringKey }[] = [
  { value: 0, label: 'session.conf0' },
  { value: 1, label: 'session.conf1' },
  { value: 2, label: 'session.conf2' },
];

/**
 * Answer → confidence → check. Confidence is stored with every attempt, which is
 * what makes the "how sure vs how right" analytics possible.
 */
export default function McqScreen() {
  const { actions } = useApp();
  const t = useT();
  const s = session.current;
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [checked, setChecked] = useState(false);
  /**
   * Consecutive correct answers in this sitting. The pill only appears from
   * three, because "1 in a row" is not a streak, it is an answer.
   */
  const [combo, setCombo] = useState(0);
  const [optionsStyle, shakeOptions] = useShake();

  const mcq = s?.mcqs[i];
  /**
   * Counted every render, on purpose.
   *
   * `session.current` is a module singleton whose `answers` object is mutated
   * in place, so its identity never changes when a question is answered. A memo
   * keyed on it would go stale immediately, which is why `i` and `checked` had
   * been listed as deps: not because the count depends on them, but as a proxy
   * for "something probably happened". Counting a handful of keys is cheaper
   * than that guess, and it cannot be wrong.
   */
  const answeredCount = s ? Object.keys(s.answers).length : 0;

  if (!s || !mcq) {
    return (
      <Screen>
        <Card flat style={{ marginTop: S.xl, alignItems: 'center', gap: S.md }}>
          <H3>{t('session.noSession')}</H3>
          <Small style={{ textAlign: 'center' }}>{t('session.noSessionBody')}</Small>
          <Btn title={t('session.setUpSession')} sm onPress={() => router.replace('/session/setup')} />
        </Card>
      </Screen>
    );
  }

  const correct = checked && chosen === mcq.answer;

  function check() {
    if (chosen == null || confidence == null) return;
    const isRight = chosen === mcq!.answer;
    setChecked(true);
    if (isRight) {
      tick();
      setCombo((c) => c + 1);
    } else {
      thud();
      shakeOptions();
      setCombo(0);
    }
    session.answer({ mcqId: mcq!.id, chosen, confidence, correct: isRight });
    actions.recordAttempt({
      mcqId: mcq!.id,
      chapterId: mcq!.chapterId,
      subjectId: s!.subjectId,
      topic: mcq!.topic,
      correct: isRight,
      confidence,
      mode: 'practice',
    });
  }

  function next() {
    if (i + 1 >= s!.mcqs.length) {
      router.replace('/session/result');
      return;
    }
    setI(i + 1);
    setChosen(null);
    setConfidence(null);
    setChecked(false);
  }

  const xpGain = XP.forAnswer(true, confidence);

  return (
    <Screen
      footer={
        checked ? (
          <Row gap={S.sm}>
            <View style={{ flex: 1 }}>
              <Btn
                title={t('session.askAi')}
                variant="line"
                icon="spark"
                onPress={() => {
                  // Tell the tutor what was picked, so the answer addresses
                  // THIS student's confusion instead of re-teaching the topic.
                  const wrong = chosen != null && chosen !== mcq.answer;
                  const prompt = wrong
                    ? `I answered "${mcq.options[chosen]}" but the correct answer is "${mcq.options[mcq.answer]}" for: ${mcq.q}. Why is my answer wrong?`
                    : mcq.q;
                  router.push(`/tutor/chat?q=${encodeURIComponent(prompt)}`);
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Btn title={i + 1 >= s.mcqs.length ? t('session.seeResult') : t('session.nextQuestion')} onPress={next} />
            </View>
          </Row>
        ) : (
          <Btn title={t('session.check')} onPress={check} disabled={chosen == null || confidence == null} />
        )
      }
    >
      <SessionHeader
        onClose={() => (answeredCount ? router.replace('/session/result') : router.back())}
        pct={((i + (checked ? 1 : 0)) / s.mcqs.length) * 100}
        label={t('session.questionOf', { a: i + 1, b: s.mcqs.length })}
        right={<Pill tone="grey">{mcq.topic}</Pill>}
        segments={s.mcqs.map((q, j) => {
          const a = s.answers[q.id];
          if (j === i && !checked) return 'current';
          if (a) return a.correct ? 'ok' : 'bad';
          return j < i ? 'done' : 'todo';
        })}
      />

      <Spacer h={S.md} />
      <ScriptText text={mcq.q} face="display" size={18} />
      <Spacer h={S.md} />

      {combo >= 3 ? (
        <Pop style={{ alignSelf: 'flex-start', marginBottom: S.sm }}>
          <Row
            gap={5}
            style={{
              backgroundColor: C.orangeTint,
              borderColor: C.orange,
              borderWidth: 1.5,
              borderRadius: 99,
              paddingVertical: 5,
              paddingHorizontal: 12,
              alignItems: 'center',
            }}
          >
            <Icon name="flame" size={14} color={C.orangeDark} fill={C.orange} />
            <Text style={{ fontFamily: F.bodyBold, fontSize: 12.5, color: C.orangeDark }}>
              {t('session.combo', { n: combo })}
            </Text>
          </Row>
        </Pop>
      ) : null}

      <Animated.View style={optionsStyle}>
      {mcq.options.map((opt, n) => {
        const isChosen = chosen === n;
        const isAnswer = n === mcq.answer;
        const kind = checked ? (isAnswer ? 'ok' : isChosen ? 'bad' : 'idle') : isChosen ? 'sel' : 'idle';
        const border = { ok: C.green, bad: C.red, sel: C.teal, idle: C.line }[kind];
        const bg = { ok: C.greenTint, bad: C.redTint, sel: C.tealTint, idle: C.card }[kind];
        const keyBg = { ok: C.green, bad: C.red, sel: C.teal, idle: C.grey }[kind];
        const keyFg = kind === 'idle' ? C.ink2 : '#fff';
        return (
          <Tap key={n} onPress={checked ? undefined : () => setChosen(n)}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: S.md,
                backgroundColor: bg,
                borderWidth: 1.5,
                borderColor: border,
                borderRadius: 15,
                paddingVertical: 14,
                paddingHorizontal: 14,
                marginBottom: S.sm,
                minHeight: 56,
              }}
            >
              <View style={{ width: 27, height: 27, borderRadius: 9, backgroundColor: keyBg, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: F.bodyBold, fontSize: 12.5, color: keyFg }}>{String.fromCharCode(65 + n)}</Text>
              </View>
              <ScriptText text={opt} size={14.5} style={{ flex: 1 }} />
              {checked && isAnswer ? <Icon name="check" size={19} color={C.green} strokeWidth={2.6} /> : null}
            </View>
          </Tap>
        );
      })}
      </Animated.View>

      {/* confidence */}
      {chosen != null && !checked ? (
        <>
          <Label style={{ marginTop: S.sm, marginBottom: 8 }}>{t('session.howSure')}</Label>
          <Row gap={S.sm}>
            {LEVELS.map((l) => {
              const on = confidence === l.value;
              return (
                <Tap key={l.value} onPress={() => setConfidence(l.value)} style={{ flex: 1 }}>
                  <View
                    style={{
                      paddingVertical: 13,
                      borderRadius: 13,
                      borderWidth: 1.5,
                      borderColor: on ? C.orange : C.line,
                      backgroundColor: on ? C.orangeTint : C.card,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontFamily: F.bodyBold, fontSize: 12.5, color: on ? C.orangeDark : C.ink2 }}>{t(l.label)}</Text>
                  </View>
                </Tap>
              );
            })}
          </Row>
          {confidence != null ? (
            <Small style={{ marginTop: 8 }}>
              {confidence === 2
                ? t('session.confHintSure', { xp: xpGain })
                : confidence === 0
                  ? t('session.confHintGuess')
                  : t('session.confHintMid', { xp: xpGain })}
            </Small>
          ) : null}
        </>
      ) : null}

      {/* feedback */}
      {checked ? (
        <>
          <Card flat tint={correct ? C.greenTint : C.redTint} border={correct ? C.green : C.red} style={{ marginTop: S.sm }}>
            <Row gap={S.sm}>
              <Icon name={correct ? 'check' : 'close'} size={20} color={correct ? C.green : C.red} strokeWidth={2.6} />
              <Text style={{ flex: 1, fontFamily: F.bodyBold, fontSize: 14, color: correct ? C.green : C.red }}>
                {correct ? t('session.correct', { xp: XP.forAnswer(true, confidence) }) : t('session.wrong')}
              </Text>
            </Row>
          </Card>

          {!correct && confidence === 2 ? (
            <Card flat tint={C.orangeTint} border={C.orange} style={{ marginTop: S.sm }}>
              <Body style={{ fontFamily: F.bodyBold, fontSize: 13.5, color: C.orangeDark }}>{t('session.confidentWrong')}</Body>
            </Card>
          ) : null}
          {correct && confidence === 0 ? (
            <Card flat tint={C.tealTint} style={{ marginTop: S.sm }}>
              <Body style={{ fontSize: 13.5 }}>{t('session.luckyGuess')}</Body>
            </Card>
          ) : null}

          <Card style={{ marginTop: S.sm }}>
            <Label style={{ color: C.teal }}>{t('session.why')}</Label>
            <ScriptText text={mcq.explanation} size={14} style={{ marginTop: 4 }} />
            <Spacer h={S.sm} />
            <Tap onPress={() => router.push(`/learn/reader/${mcq.chapterId}`)} hit>
              <Text style={{ fontFamily: F.bodyBold, fontSize: 12.5, color: C.teal }}>{t('session.readInChapter')} →</Text>
            </Tap>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
