import { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { Btn, Card, Confirm, H3, IconButton, Pill, Row, Screen, ScriptText, Small, Spacer, Tap, useToast } from '../../src/components/ui';
import { isUrduScript } from '@matricmate/core';
import { SegmentTrack } from '../../src/components/SessionHeader';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { session } from '../../src/store/session';
import { C, F, S, isRTL } from '../../src/theme';

export default function Exam() {
  const { actions } = useApp();
  const t = useT();
  const toast = useToast();
  const s = session.current;
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [flags, setFlags] = useState<string[]>([]);
  const [left, setLeft] = useState(s?.durationSec ?? 1800);
  const [confirm, setConfirm] = useState(false);
  const submitted = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  /**
   * Hardware back held every answer in local state and simply popped the
   * screen: twenty answered questions gone with one reflex tap. It now raises
   * the same submit sheet the button does, so leaving is always a decision.
   */
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (submitted.current) return false;
      setConfirm(true);
      return true;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (left === 0) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  const mcq = s?.mcqs[i];
  const unanswered = useMemo(() => (s ? s.mcqs.filter((m) => answers[m.id] == null).length : 0), [s, answers]);

  function submit() {
    if (!s) return;
    // The timeout path and the button can fire together, and a second pass
    // would record every attempt twice: double XP, double history.
    if (submitted.current) return;
    submitted.current = true;
    s.mcqs.forEach((m) => {
      const chosen = answers[m.id] ?? null;
      const correct = chosen === m.answer;
      session.answer({ mcqId: m.id, chosen, confidence: null, correct, flagged: flags.includes(m.id) });
      if (chosen != null) {
        actions.recordAttempt({
          mcqId: m.id,
          chapterId: m.chapterId,
          subjectId: s.subjectId,
          topic: m.topic,
          correct,
          confidence: null,
          mode: 'exam',
        });
      }
    });
    router.replace('/session/result');
  }

  if (!s || !mcq) {
    return (
      <Screen>
        <Card flat style={{ marginTop: S.xl, alignItems: 'center', gap: S.md }}>
          <H3>{t('session.noSession')}</H3>
          <Btn title={t('session.setUpSession')} sm onPress={() => router.replace('/session/exam-intro')} />
        </Card>
      </Screen>
    );
  }

  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  const urgent = left < 120;
  const flagged = flags.includes(mcq.id);

  return (
    <>
      <Screen
        footer={
          <Row gap={S.sm}>
            <View style={{ flex: 1 }}>
              <Btn title={t('session.submit')} variant="line" onPress={() => setConfirm(true)} />
            </View>
            <View style={{ flex: 1 }}>
              <Btn
                title={i + 1 >= s.mcqs.length ? t('session.lastQuestion') : t('common.next')}
                onPress={() => setI(Math.min(s.mcqs.length - 1, i + 1))}
                disabled={i + 1 >= s.mcqs.length}
              />
            </View>
          </Row>
        }
      >
        <Row style={{ paddingTop: S.xs }} gap={S.sm}>
          <View style={isRTL() ? { marginRight: -10 } : { marginLeft: -10 }}>
            <IconButton icon="close" onPress={() => setConfirm(true)} />
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Pill tone={urgent ? 'red' : 'orange'} icon="clock" style={{ paddingVertical: 8, paddingHorizontal: 16 }}>
              {`${mm}:${ss}`}
            </Pill>
          </View>
          <Tap
            onPress={() => {
              setFlags((f) => (flagged ? f.filter((x) => x !== mcq.id) : [...f, mcq.id]));
              toast(flagged ? t('session.flagRemoved') : t('session.flagged'));
            }}
          >
            <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="star" color={flagged ? C.orange : C.ink3} />
            </View>
          </Tap>
        </Row>

        <Spacer h={S.sm} />
        <SegmentTrack
          segments={s.mcqs.map((m, j) => (j === i ? 'current' : answers[m.id] != null ? 'done' : 'todo'))}
        />
        <Small style={{ fontFamily: F.bodyBold, marginTop: 4 }}>
          {t('session.questionOf', { a: i + 1, b: s.mcqs.length })}
        </Small>
        <ScriptText text={mcq.q} face="display" size={18} style={{ marginVertical: S.md }} />

        {mcq.options.map((opt, n) => {
          const sel = answers[mcq.id] === n;
          return (
            <Tap key={n} onPress={() => setAnswers((a) => ({ ...a, [mcq.id]: n }))}>
              <View
                style={{
                  // The letter key sits on the side the option starts from.
                  flexDirection: isUrduScript(opt) ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: S.md,
                  backgroundColor: sel ? C.tealTint : C.card,
                  borderWidth: 1.5,
                  borderColor: sel ? C.teal : C.line,
                  borderRadius: 15,
                  paddingVertical: 14,
                  paddingHorizontal: 14,
                  marginBottom: S.sm,
                  minHeight: 56,
                }}
              >
                <View
                  style={{
                    width: 27,
                    height: 27,
                    borderRadius: 9,
                    backgroundColor: sel ? C.teal : C.grey,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontFamily: F.bodyBold, fontSize: 12.5, color: sel ? C.onBrand : C.ink2 }}>
                    {String.fromCharCode(65 + n)}
                  </Text>
                </View>
                <ScriptText text={opt} size={14.5} style={{ flex: 1 }} />
              </View>
            </Tap>
          );
        })}

        <Spacer h={S.md} />
        <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          {s.mcqs.map((m, n) => {
            const answered = answers[m.id] != null;
            const isFlagged = flags.includes(m.id);
            const current = n === i;
            const bg = current ? C.orange : answered ? C.teal : isFlagged ? C.orangeTint : C.grey;
            const fg = current || answered ? C.onBrand : isFlagged ? C.orangeDark : C.ink2;
            return (
              <Tap key={m.id} onPress={() => setI(n)} hit>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: F.bodyBold, fontSize: 12, color: fg }}>{n + 1}</Text>
                </View>
              </Tap>
            );
          })}
        </Row>
        <Spacer h={S.sm} />
        <Small style={{ textAlign: 'center' }}>{t('session.jumpHint')}</Small>
      </Screen>

      <Confirm
        visible={confirm}
        onClose={() => setConfirm(false)}
        title={t('session.submitTitle')}
        body={`${unanswered ? t('session.unanswered', { n: unanswered }) : t('session.allAnswered')} ${t('session.noChangeAfter')}`}
        confirmLabel={t('session.submitNow')}
        cancelLabel={t('session.keepWorking')}
        tone="orange"
        onConfirm={submit}
      />
    </>
  );
}
