import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { Bar, Btn, Card, Empty, ErrorState, Header, Row, Screen, Skeleton, Small, Spacer, Tap } from '../../src/components/ui';
import { api, blankHalves, chaptersFor } from '@matricmate/core';
import { useAsync } from '../../src/core/useAsync';
import { Confetti, Pop } from '../../src/components/celebration';
import { cheer, thud, tick } from '../../src/core/haptics';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, S } from '../../src/theme';

export default function Blanks() {
  const { chapter } = useLocalSearchParams<{ chapter?: string }>();
  const { state, actions } = useApp();
  // Arriving with no chapter param used to mean Physics chapter 3 for
  // everyone. Follow the student instead: the chapter they last studied,
  // else the first chapter of their first subject.
  const chapterId = chapter ?? state.lastChapterId ?? chaptersFor(state.onboarding?.subjects?.[0] ?? 'phy')[0]?.id ?? 'phy-1';
  const t = useT();
  const { data: content, loading, error, reload } = useAsync(() => api.getChapterContent(chapterId), [chapterId]);

  const [i, setI] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [right, setRight] = useState(0);

  const items = content?.blanks ?? [];
  const item = items[i];
  const halves = item ? blankHalves(item.sentence[0], item.sentence[1]) : ['', ''];
  const done = !!content && i >= items.length;

  useEffect(() => {
    if (done) cheer();
  }, [done]);


  // A failed fetch is not an empty chapter, and an empty chapter is not a
  // finished session. Without these two branches, a network error rendered a
  // blank card, and a chapter with none of this practice type opened straight
  // onto the confetti screen claiming "0 of 0, well done".
  if (error && !items.length) {
    return (
      <Screen>
        <Header title={t('practice.blanks')} back />
        <Spacer h={S.lg} />
        <ErrorState title={t('states.errorTitle')} sub={t('states.errorBody')} retry={t('common.retry')} onRetry={reload} />
      </Screen>
    );
  }
  if (!loading && content && items.length === 0) {
    return (
      <Screen>
        <Header title={t('practice.blanks')} back />
        <Spacer h={S.lg} />
        <Empty title={t('session.noItemsTitle')} sub={t('session.noItemsBody')} />
      </Screen>
    );
  }  const correct = checked && pick === item?.answer;

  function check() {
    if (!item || !pick) return;
    const ok = pick === item.answer;
    setChecked(true);
    if (ok) tick();
    else thud();
    if (ok) setRight((r) => r + 1);
    actions.recordAttempt({
      mcqId: item.id,
      chapterId,
      subjectId: chapterId.split('-')[0],
      topic: t('practice.blanks'),
      correct: ok,
      confidence: null,
      mode: 'blanks',
    });
  }

  if (loading) {
    return (
      <Screen>
        <Header title={t('practice.blanks')} back />
        <Skeleton h={120} />
      </Screen>
    );
  }

  if (done) {
    return (
      <Screen>
        <Confetti />
        <Header title={t('practice.blanks')} back />
        <Pop>
        <Card style={{ alignItems: 'center', gap: S.sm, paddingVertical: 26 }}>
          <Text style={{ fontFamily: F.display, fontSize: 21, color: C.ink }}>
            {t('session.blanksDone', { a: right, b: items.length })}
          </Text>
          <Small style={{ textAlign: 'center' }}>{t('session.blanksDoneSub')}</Small>
        </Card>
        </Pop>
        <Spacer h={S.lg} />
        <Btn title={t('session.backToChapter')} onPress={() => router.replace(`/learn/chapter/${chapterId}`)} />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        checked ? (
          <Btn
            title={i + 1 >= items.length ? t('session.seeResult') : t('common.next')}
            onPress={() => {
              setI(i + 1);
              setPick(null);
              setChecked(false);
            }}
          />
        ) : (
          <Btn title={t('session.blanksCheck')} onPress={check} disabled={!pick} />
        )
      }
    >
      <Header title={t('practice.blanks')} sub={t('session.blanksItem', { a: i + 1, b: items.length })} back />
      <Bar pct={(i / Math.max(1, items.length)) * 100} tone="teal" />
      <Spacer h={S.lg} />

      <Card>
        <Text style={{ fontFamily: F.display, fontSize: 18, lineHeight: 34, color: C.ink }}>
          {halves[0]}
          <Text
            style={{
              fontFamily: F.bodyBold,
              color: checked ? (correct ? C.green : C.red) : pick ? C.teal : C.ink3,
              textDecorationLine: 'underline',
            }}
          >
            {pick ?? '_______'}
          </Text>
          {halves[1]}
        </Text>
      </Card>

      <Spacer h={S.md} />
      {/* Real answer buttons, two per row. These were Pills, which are made
          for labels: at label size the four choices read as tags, not as
          things a student is supposed to press. */}
      <Row gap={S.sm} style={{ flexWrap: 'wrap' }}>
        {item?.options.map((o) => {
          const selected = pick === o;
          const isAnswer = o === item.answer;
          const look = checked
            ? isAnswer
              ? { bg: C.greenTint, line: C.green, text: C.green }
              : selected
                ? { bg: C.redTint, line: C.red, text: C.red }
                : { bg: C.card, line: C.line, text: C.ink3 }
            : selected
              ? { bg: C.tealTint, line: C.teal, text: C.teal }
              : { bg: C.card, line: C.line, text: C.ink };
          return (
            <Tap
              key={o}
              onPress={checked ? undefined : () => setPick(o)}
              style={{
                flexGrow: 1,
                flexBasis: '47%',
                minHeight: 52,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 14,
                borderWidth: 1.5,
                backgroundColor: look.bg,
                borderColor: look.line,
              }}
            >
              <Text style={{ fontFamily: F.bodyBold, fontSize: 15.5, color: look.text }}>{o}</Text>
            </Tap>
          );
        })}
      </Row>

      {checked ? (
        <Card flat tint={correct ? C.greenTint : C.redTint} border={correct ? C.green : C.red} style={{ marginTop: S.md }}>
          <Row gap={S.sm}>
            <Icon name={correct ? 'check' : 'close'} size={18} color={correct ? C.green : C.red} strokeWidth={2.6} />
            <Text style={{ flex: 1, fontFamily: F.bodyBold, fontSize: 13.5, color: correct ? C.green : C.red }}>
              {correct ? t('session.blanksCorrect') : t('session.blanksWrong', { a: item?.answer ?? '' })}
            </Text>
          </Row>
          {!correct && item ? (
            <>
              <Spacer h={S.sm} />
              <Btn
                title={t('session.askAi')}
                variant="line"
                sm
                onPress={() =>
                  router.push(
                    `/tutor/chat?q=${encodeURIComponent(
                      `Why does "${item.answer}" fit here: "${item.sentence[0]} ____ ${item.sentence[1]}"?`
                    )}`
                  )
                }
              />
            </>
          ) : null}
        </Card>
      ) : null}
    </Screen>
  );
}
