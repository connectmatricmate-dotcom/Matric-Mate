import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { Btn, Card, Empty, ErrorState, Header, Row, Screen, ScriptText, Skeleton, Small, Spacer, Tap } from '../../src/components/ui';
import { SegmentTrack } from '../../src/components/SessionHeader';
import { api, blankHalves, chapterById, chaptersFor, fetchAiSession, isUrduScript, normalizeAiBlanks } from '@matricmate/core';
import { useAsync } from '../../src/core/useAsync';
import { Confetti, Pop } from '../../src/components/celebration';
import { cheer, thud, tick } from '../../src/core/haptics';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, S, urdu } from '../../src/theme';

export default function Blanks() {
  const { chapter, ai } = useLocalSearchParams<{ chapter?: string; ai?: string }>();
  const { state, actions } = useApp();
  // Arriving with no chapter param used to mean Physics chapter 3 for
  // everyone. Follow the student instead: the chapter they last studied,
  // else the first chapter of their first subject.
  const chapterId = chapter ?? state.lastChapterId ?? chaptersFor(state.onboarding?.subjects?.[0] ?? 'phy')[0]?.id ?? 'phy-1';
  const t = useT();
  // An ?ai= id swaps the bank for a set the student asked the AI to build.
  const { data: content, loading, error, reload } = useAsync(async () => {
    if (ai) {
      const s = await fetchAiSession(ai);
      if (!s) throw new Error('missing session');
      return { blanks: normalizeAiBlanks(s.items as Parameters<typeof normalizeAiBlanks>[0], s.chapterId ?? chapterId) };
    }
    return api.getChapterContent(chapterId);
  }, [chapterId, ai ?? '']);

  const [i, setI] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [right, setRight] = useState(0);
  // One mark per completed item, feeding the header's segments.
  const [marks, setMarks] = useState<('ok' | 'bad')[]>([]);

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
    setMarks((m) => [...m, ok ? 'ok' : 'bad']);
    actions.recordAttempt({
      mcqId: item.id,
      chapterId,
      subjectId: chapterId.split('-')[0],
      // The chapter's own title, not the name of the exercise. This used
      // to store the translated UI label, so Weak topics listed
      // "Fill in the blanks" as a syllabus topic, and switching language
      // forked it into a second one.
      topic: chapterById(chapterId)?.title ?? chapterId,
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

  const verdictLine = correct ? t('session.blanksCorrect') : t('session.blanksWrong', { a: item?.answer ?? '' });

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
      <SegmentTrack segments={items.map((_, j) => marks[j] ?? (j === i && !checked ? 'current' : 'todo'))} />
      <Spacer h={S.lg} />

      <Card>
        <Text
          style={
            // Urdu sentences take the Urdu treatment; the nested pick Text
            // inherits the face, so one switch covers the whole line.
            isUrduScript(item?.sentence.join('') ?? '')
              ? [urdu(17), { color: C.ink }]
              : { fontFamily: F.display, fontSize: 18, lineHeight: 34, color: C.ink }
          }
        >
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
              <ScriptText text={o} face="bodyBold" size={15.5} color={look.text} />
            </Tap>
          );
        })}
      </Row>

      {checked ? (
        <Card flat tint={correct ? C.greenTint : C.redTint} border={correct ? C.green : C.red} style={{ marginTop: S.md }}>
          {/* The verdict quotes the answer, so it can be Urdu. Then the tick
              belongs where the line starts, on the right. */}
          <Row gap={S.sm} style={{ flexDirection: isUrduScript(verdictLine) ? 'row-reverse' : 'row' }}>
            <Icon name={correct ? 'check' : 'close'} size={18} color={correct ? C.green : C.red} strokeWidth={2.6} />
            <ScriptText text={verdictLine} face="bodyBold" size={13.5} color={correct ? C.green : C.red} style={{ flex: 1 }} />
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
                    )}&chapter=${chapterId}`
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
