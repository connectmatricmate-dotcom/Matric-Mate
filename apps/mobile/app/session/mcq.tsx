import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import {
  Bar,
  Body,
  Btn,
  Card,
  H3,
  Label,
  Pill,
  Row,
  Screen,
  Small,
  Spacer,
  Tap,
  useToast,
} from '../../src/components/ui';
import { XP } from '../../src/core/domain';
import { Confidence } from '../../src/core/types';
import { useApp } from '../../src/store/app';
import { session } from '../../src/store/session';
import { C, F, S } from '../../src/theme';

const LEVELS: { value: Confidence; label: string }[] = [
  { value: 0, label: 'Tukka 🎲' },
  { value: 1, label: 'Thora sure' },
  { value: 2, label: 'Pakka ✓' },
];

/**
 * The signature flow: answer → Pakka-meter (how sure are you?) → check.
 * Confidence is stored with every attempt and drives the confidence-vs-accuracy
 * analytics, which is what makes the practice data worth something.
 */
export default function McqScreen() {
  const { actions } = useApp();
  const toast = useToast();
  const s = session.current;
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [checked, setChecked] = useState(false);

  const mcq = s?.mcqs[i];
  const answeredCount = useMemo(() => (s ? Object.keys(s.answers).length : 0), [s, i, checked]);

  if (!s || !mcq) {
    return (
      <Screen>
        <Card flat style={{ marginTop: S.xl, alignItems: 'center', gap: S.md }}>
          <H3>No active session</H3>
          <Small>Start a practice session to see questions here.</Small>
          <Btn title="Set up a session" sm onPress={() => router.replace('/session/setup')} />
        </Card>
      </Screen>
    );
  }

  const correct = checked && chosen === mcq.answer;

  function check() {
    if (chosen == null || confidence == null) return;
    const isRight = chosen === mcq!.answer;
    setChecked(true);
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
              <Btn title="Ask AI" variant="line" icon="spark" onPress={() => router.push(`/tutor/chat?q=${encodeURIComponent(mcq.q)}`)} />
            </View>
            <View style={{ flex: 1 }}>
              <Btn title={i + 1 >= s.mcqs.length ? 'See result' : 'Next question'} onPress={next} />
            </View>
          </Row>
        ) : (
          <Btn title="Check answer" onPress={check} disabled={chosen == null || confidence == null} />
        )
      }
    >
      {/* progress header */}
      <Row gap={S.md} style={{ paddingTop: S.sm }}>
        <Tap onPress={() => (answeredCount ? router.replace('/session/result') : router.back())} hit>
          <Icon name="close" color={C.ink} />
        </Tap>
        <View style={{ flex: 1 }}>
          <Bar pct={((i + (checked ? 1 : 0)) / s.mcqs.length) * 100} tone="teal" h={6} />
          <Small style={{ fontFamily: F.bodyBold, fontSize: 11, marginTop: 3 }}>
            Question {i + 1} of {s.mcqs.length}
          </Small>
        </View>
        <Pill tone="grey">{mcq.topic}</Pill>
      </Row>

      <Spacer h={S.md} />
      <Text style={{ fontFamily: F.display, fontSize: 18, lineHeight: 26, color: C.ink }}>{mcq.q}</Text>
      <Spacer h={S.md} />

      {mcq.options.map((opt, n) => {
        const isChosen = chosen === n;
        const isAnswer = n === mcq.answer;
        const state_ = checked ? (isAnswer ? 'ok' : isChosen ? 'bad' : 'idle') : isChosen ? 'sel' : 'idle';
        const border = { ok: C.green, bad: C.red, sel: C.teal, idle: C.line }[state_];
        const bg = { ok: C.greenTint, bad: C.redTint, sel: C.tealTint, idle: C.card }[state_];
        const keyBg = { ok: C.green, bad: C.red, sel: C.teal, idle: C.grey }[state_];
        const keyFg = state_ === 'idle' ? C.ink2 : '#fff';
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
                paddingVertical: 13,
                paddingHorizontal: 14,
                marginBottom: S.sm,
              }}
            >
              <View style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: keyBg, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: F.bodyBold, fontSize: 12.5, color: keyFg }}>{String.fromCharCode(65 + n)}</Text>
              </View>
              <Text style={{ flex: 1, fontFamily: F.body, fontSize: 14.5, color: C.ink }}>{opt}</Text>
              {checked && isAnswer ? <Icon name="check" size={18} color={C.green} strokeWidth={2.6} /> : null}
            </View>
          </Tap>
        );
      })}

      {/* Pakka-meter */}
      {chosen != null && !checked ? (
        <>
          <Label style={{ marginTop: S.sm, marginBottom: 6 }}>How sure are you?</Label>
          <Row gap={S.sm}>
            {LEVELS.map((l) => {
              const on = confidence === l.value;
              return (
                <Tap key={l.value} onPress={() => setConfidence(l.value)} style={{ flex: 1 }}>
                  <View
                    style={{
                      paddingVertical: 11,
                      borderRadius: 13,
                      borderWidth: 1.5,
                      borderColor: on ? C.orange : C.line,
                      backgroundColor: on ? C.orangeTint : C.card,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontFamily: F.bodyBold, fontSize: 12.5, color: on ? C.orangeDark : C.ink2 }}>{l.label}</Text>
                  </View>
                </Tap>
              );
            })}
          </Row>
          {confidence != null ? (
            <Small style={{ marginTop: 6 }}>
              {confidence === 2 ? `Pakka answers earn ${xpGain} XP — and we track how often you're right.` : confidence === 0 ? 'Honest guess — worth less XP, but it keeps your stats real.' : `Worth ${xpGain} XP.`}
            </Small>
          ) : null}
        </>
      ) : null}

      {/* feedback */}
      {checked ? (
        <>
          <Card
            flat
            tint={correct ? C.greenTint : C.redTint}
            border={correct ? C.green : C.red}
            style={{ marginTop: S.sm }}
          >
            <Row gap={S.sm}>
              <Icon name={correct ? 'check' : 'close'} size={20} color={correct ? C.green : C.red} strokeWidth={2.6} />
              <Text style={{ flex: 1, fontFamily: F.bodyBold, fontSize: 14, color: correct ? C.green : C.red }}>
                {correct ? `Sahi jawab! +${XP.forAnswer(true, confidence)} XP` : 'Ghalat — no tension, dekho kyun.'}
              </Text>
            </Row>
          </Card>

          {/* the coaching moment: confident and wrong */}
          {!correct && confidence === 2 ? (
            <Card flat tint={C.orangeTint} border={C.orange} style={{ marginTop: S.sm }}>
              <Body style={{ fontFamily: F.bodyBold, fontSize: 13.5, color: C.orangeDark }}>
                You said Pakka — is concept ko dobara dekh lo 👀
              </Body>
            </Card>
          ) : null}
          {correct && confidence === 0 ? (
            <Card flat tint={C.tealTint} style={{ marginTop: S.sm }}>
              <Body style={{ fontSize: 13.5 }}>Tukka lag gaya — but revise it once so next time it’s Pakka.</Body>
            </Card>
          ) : null}

          <Card style={{ marginTop: S.sm }}>
            <Label style={{ color: C.teal }}>Why</Label>
            <Body style={{ marginTop: 4 }}>{mcq.explanation}</Body>
            <Spacer h={S.sm} />
            <Tap onPress={() => router.push(`/learn/reader/${mcq.chapterId}`)}>
              <Text style={{ fontFamily: F.bodyBold, fontSize: 12.5, color: C.teal }}>Read this in the chapter →</Text>
            </Tap>
          </Card>
        </>
      ) : null}
      <Spacer h={S.lg} />
    </Screen>
  );
}
