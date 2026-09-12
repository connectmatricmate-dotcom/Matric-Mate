import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { Btn, Card, Empty, ErrorState, Header, Row, Screen, ScriptText, Skeleton, Small, Spacer, Tap, Text } from '../../src/components/ui';
import { SegmentTrack } from '../../src/components/SessionHeader';
import { api, blankHalves, fetchAiSession, isUrduScript, normalizeAiBlanks } from '@matricmate/core';
import { useAsync } from '../../src/core/useAsync';
import { Confetti, Pop } from '../../src/components/celebration';
import { PickPracticeChapter, PracticeChapterBar, usePracticeChapter } from '../../src/components/PracticeChapter';
import { cheer, thud, tick } from '../../src/core/haptics';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, S, urdu } from '../../src/theme';

export default function Blanks() {
  const { chapter, ai } = useLocalSearchParams<{ chapter?: string; ai?: string }>();
  const { actions, contentKey } = useApp();
  // No chapter in the link: one of the student's own chapters that has
  // notes, or a picker. See PracticeChapter.
  const practice = usePracticeChapter(chapter, 'blanks');
  const chapterId = practice.chapterId;
  const t = useT();
  // An ?ai= id swaps the bank for a set the student asked the AI to build.
  const { data: content, loading, error, reload } = useAsync(async () => {
    if (ai) {
      const s = await fetchAiSession(ai);
      if (!s) throw new Error('missing session');
      // The set's own id in every item's id: see normalizeAiBlanks.
      return { blanks: normalizeAiBlanks(s.items as Parameters<typeof normalizeAiBlanks>[0], s.chapterId ?? chapterId ?? '', ai) };
    }
    return chapterId ? api.getChapterContent(chapterId) : { blanks: [] };
    // contentKey: a language, class or board switch reaches an open screen.
  }, [chapterId ?? '', ai ?? '', contentKey]);

  const [i, setI] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [right, setRight] = useState(0);
  // One mark per completed item, feeding the header's segments.
  const [marks, setMarks] = useState<('ok' | 'bad')[]>([]);

  const items = content?.blanks ?? [];
  const item = items[i];
  const halves = item ? blankHalves(item.sentence[0], item.sentence[1]) : ['', ''];
  // Not done with nothing to do: an empty set used to fire the finish cheer.
  const done = items.length > 0 && i >= items.length;

  useEffect(() => {
    if (done) cheer();
  }, [done]);

  // Which chapter, before anything about its items: none of theirs has notes
  // yet, or the chapter index is still on its way.
  if (!ai && !chapterId) {
    return (
      <Screen>
        <Header title={t('practice.blanks')} back />
        {practice.waiting ? <Skeleton h={120} /> : <PickPracticeChapter kind="blanks" />}
      </Screen>
    );
  }

  // A failed fetch is not an empty chapter, and an empty chapter is not a
  // finished session. Without these two branches, a network error rendered a
  // blank card, and a chapter with none of this practice type opened straight
  // onto the confetti screen claiming "0 of 0, well done".
  if (error && !items.length) {
    return (
      <Screen>
        <Header title={t('practice.blanks')} back />
        {ai ? null : <PracticeChapterBar kind="blanks" chapter={practice.chapter} />}
        <Spacer h={S.lg} />
        <ErrorState title={t('states.errorTitle')} sub={t('states.errorBody')} retry={t('common.retry')} onRetry={reload} />
      </Screen>
    );
  }
  if (!loading && content && items.length === 0) {
    return (
      <Screen>
        <Header title={t('practice.blanks')} back />
        {/* The way out of an empty chapter is another chapter. */}
        {ai ? null : <PracticeChapterBar kind="blanks" chapter={practice.chapter} />}
        <Spacer h={S.lg} />
        <Empty title={t('session.noItemsTitle')} sub={t('session.noItemsBody')} />
      </Screen>
    );
  }
  const correct = checked && pick === item?.answer;
  // Every item carries its chapter: an AI set's own, or the chapter chosen.
  const itemChapter = item?.chapterId || chapterId || '';

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
      chapterId: itemChapter,
      // Filed under its own chapter's subject, whatever screen it came from.
      subjectId: itemChapter.split('-')[0],
      // The chapter's own name, not the name of the exercise, in the language
      // its questions are in. Never the raw id: a Class 10 or Punjab chapter
      // the index had not named yet became a weak "topic" called phy-pj-9-3.
      topic: practice.topic,
      correct: ok,
      confidence: null,
      mode: 'blanks',
    });
  }

  if (loading && !items.length) {
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
        {chapterId ? (
          <Btn title={t('session.backToChapter')} onPress={() => router.replace(`/learn/chapter/${chapterId}`)} />
        ) : null}
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
      {ai ? null : <PracticeChapterBar kind="blanks" chapter={practice.chapter} />}
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
                    // In the student's own language: an English sentence they
                    // never wrote used to open an Urdu student's chat.
                    `/tutor/chat?q=${encodeURIComponent(
                      t('session.askWhyBlank', { a: item.answer, before: item.sentence[0], after: item.sentence[1] }),
                    )}${itemChapter ? `&chapter=${itemChapter}` : ''}`,
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
