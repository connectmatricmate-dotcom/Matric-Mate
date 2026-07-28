import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { Btn, Card, H3, IconButton, Pill, Row, Screen, Sheet, Small, Spacer, Tap, useToast } from '../../src/components/ui';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { session } from '../../src/store/session';
import { C, F, S } from '../../src/theme';

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

  useEffect(() => {
    const timer = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (left === 0) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  const mcq = s?.mcqs[i];
  const unanswered = useMemo(() => (s ? s.mcqs.filter((m) => answers[m.id] == null).length : 0), [s, answers]);

  function submit() {
    if (!s) return;
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
          <View style={{ marginLeft: -10 }}>
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
        <Small style={{ fontFamily: F.bodyBold }}>{t('session.questionOf', { a: i + 1, b: s.mcqs.length })}</Small>
        <Text style={{ fontFamily: F.display, fontSize: 18, lineHeight: 27, color: C.ink, marginVertical: S.md }}>{mcq.q}</Text>

        {mcq.options.map((opt, n) => {
          const sel = answers[mcq.id] === n;
          return (
            <Tap key={n} onPress={() => setAnswers((a) => ({ ...a, [mcq.id]: n }))}>
              <View
                style={{
                  flexDirection: 'row',
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
                  <Text style={{ fontFamily: F.bodyBold, fontSize: 12.5, color: sel ? '#fff' : C.ink2 }}>
                    {String.fromCharCode(65 + n)}
                  </Text>
                </View>
                <Text style={{ flex: 1, fontFamily: F.body, fontSize: 14.5, lineHeight: 21, color: C.ink }}>{opt}</Text>
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
            const fg = current || answered ? '#fff' : isFlagged ? C.orangeDark : C.ink2;
            return (
              <Tap key={m.id} onPress={() => setI(n)}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: F.bodyBold, fontSize: 12, color: fg }}>{n + 1}</Text>
                </View>
              </Tap>
            );
          })}
        </Row>
        <Spacer h={S.sm} />
        <Small style={{ textAlign: 'center' }}>{t('session.jumpHint')}</Small>
      </Screen>

      <Sheet visible={confirm} onClose={() => setConfirm(false)} title={t('session.submitTitle')}>
        <Small>
          {unanswered ? t('session.unanswered', { n: unanswered }) : t('session.allAnswered')} {t('session.noChangeAfter')}
        </Small>
        <Spacer h={S.lg} />
        <Btn title={t('session.submitNow')} variant="orange" onPress={submit} />
        <Spacer h={S.sm} />
        <Btn title={t('session.keepWorking')} variant="ghost" onPress={() => setConfirm(false)} />
      </Sheet>
    </>
  );
}
