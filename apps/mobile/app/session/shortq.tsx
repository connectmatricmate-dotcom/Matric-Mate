import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Btn, Card, Empty, ErrorState, H2, Header, Label, Pill, Row, Screen, ScriptText, Skeleton, Small, Spacer, Text, TextInput, useToast } from '../../src/components/ui';
import { Icon } from '../../src/components/Icon';
import { SegmentTrack } from '../../src/components/SessionHeader';
import { api, checkAnswerLive, fetchAiSession, isUrduScript, normalizeAiShortQs, subjectMedium } from '@matricmate/core';
import type { AiCheckVerdict } from '@matricmate/core';
import { useAsync } from '../../src/core/useAsync';
import { Confetti, Pop } from '../../src/components/celebration';
import { PickPracticeChapter, PracticeChapterBar, PracticeEmpty, usePracticeChapter } from '../../src/components/PracticeChapter';
import { aiFailureKey } from '../../src/components/aiFailure';
import { cheer } from '../../src/core/haptics';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, S, isRTL, isWeb, textStart } from '../../src/theme';
import { Markdown } from '../../src/components/Markdown';
import { leaveSet } from '../../src/core/nav';
import { ReportAi } from '../../src/components/ReportAi';

type Mark = 'got' | 'partial' | 'missed';

export default function ShortQuestions() {
  const { chapter, ai, from } = useLocalSearchParams<{ chapter?: string; ai?: string; from?: string }>();
  const { state, actions, contentKey, derived } = useApp();
  // No chapter in the link: one of the student's own chapters that has
  // notes, or a picker. See PracticeChapter.
  const practice = usePracticeChapter(chapter, 'shortq');
  const chapterId = practice.chapterId;
  // Opened from this chapter's hub, and still on that chapter: see leaveSet.
  const fromChapter = from === 'chapter' && chapter === chapterId;
  const t = useT();
  // An ?ai= id swaps the bank for a set the student asked the AI to build.
  const { data: content, loading, error, reload } = useAsync(async () => {
    if (ai) {
      const s = await fetchAiSession(ai);
      if (!s) throw new Error('missing session');
      // The set's own id in every question's id: see normalizeAiShortQs.
      return { shortQs: normalizeAiShortQs(s.items as Parameters<typeof normalizeAiShortQs>[0], s.chapterId ?? chapterId ?? '', ai) };
    }
    return chapterId ? api.getChapterContent(chapterId) : { shortQs: [] };
    // contentKey: a language, class or board switch reaches an open screen.
  }, [chapterId ?? '', ai ?? '', contentKey]);

  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [marks, setMarks] = useState<Mark[]>([]);
  /** The student's own written answer and the examiner's verdict on it. */
  const [written, setWritten] = useState('');
  const [checking, setChecking] = useState(false);
  const [verdict, setVerdict] = useState<AiCheckVerdict | null>(null);
  const toast = useToast();

  const items = content?.shortQs ?? [];
  const item = items[i];
  // Not done with nothing to do: an empty set used to fire the finish cheer.
  const done = items.length > 0 && i >= items.length;

  useEffect(() => {
    if (done) cheer();
  }, [done]);

  // Which chapter, before anything about its questions: none of theirs has
  // notes yet, or the chapter index is still on its way.
  if (!ai && !chapterId) {
    return (
      <Screen>
        <Header title={t('practice.shortQ')} back />
        {practice.waiting ? <Skeleton h={140} /> : <PickPracticeChapter kind="shortq" />}
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
        <Header title={t('practice.shortQ')} back />
        {ai ? null : <PracticeChapterBar kind="shortq" chapter={practice.chapter} />}
        <Spacer h={S.lg} />
        <ErrorState title={t('states.errorTitle')} sub={t('states.errorBody')} retry={t('common.retry')} onRetry={reload} />
      </Screen>
    );
  }
  if (!loading && content && items.length === 0) {
    return (
      <Screen>
        <Header title={t('practice.shortQ')} back />
        {/* The way out of an empty chapter is another chapter. */}
        {ai ? null : <PracticeChapterBar kind="shortq" chapter={practice.chapter} />}
        <Spacer h={S.lg} />
        {ai ? (
          <Empty title={t('session.noItemsTitle')} sub={t('session.noItemsBody')} />
        ) : (
          <PracticeEmpty kind="shortq" chapterId={chapterId} chapter={practice.chapter} onRetry={reload} />
        )}
      </Screen>
    );
  }
  // Every item carries its chapter: an AI set's own, or the chapter chosen.
  const itemChapter = item?.chapterId || chapterId || '';

  /** Send the written answer to the AI examiner; reveal comes with marks. */
  async function checkMine() {
    if (!item || !written.trim() || checking) return;
    setChecking(true);
    const res = await checkAnswerLive({
      question: item.q,
      modelAnswer: item.answer,
      points: item.points,
      marks: item.marks,
      answer: written.trim(),
      // Marked in the language the subject is written in: an Urdu answer to
      // an Urdu question from an English-medium student, and the reverse.
      medium: itemChapter
        ? subjectMedium(itemChapter, state.onboarding?.board, state.settings.contentMedium)
        : state.settings.contentMedium,
      // Where the question is from: a free trial's answers are marked only in
      // its own subject, and the server refuses a check that does not say.
      chapterId: itemChapter || undefined,
    });
    setChecking(false);
    if (!res.ok) {
      toast(t(aiFailureKey(res.reason)));
      return;
    }
    // Only the fields the card draws, checked: a reply without a list of
    // missed points once took this screen down to the error boundary.
    setVerdict({ ...res.verdict, missed: Array.isArray(res.verdict.missed) ? res.verdict.missed : [] });
    setRevealed(true);
  }

  function mark(m: Mark) {
    if (!item) return;
    setMarks((prev) => [...prev, m]);
    actions.recordAttempt({
      mcqId: item.id,
      chapterId: itemChapter,
      // Filed under its own chapter's subject, whatever screen it came from.
      subjectId: itemChapter.split('-')[0],
      // The chapter's own name, not the name of the exercise, in the language
      // its questions are in. Never the raw id: see blanks.
      topic: practice.topic,
      correct: m === 'got',
      confidence: null,
      mode: 'shortq',
    });
    setRevealed(false);
    setWritten('');
    setVerdict(null);
    setI(i + 1);
  }

  if (loading && !items.length) {
    return (
      <Screen>
        <Header title={t('practice.shortQ')} back />
        <Skeleton h={140} />
      </Screen>
    );
  }

  if (done) {
    const got = marks.filter((m) => m === 'got').length;
    return (
      <Screen>
        <Confetti />
        <Header title={t('practice.shortQ')} back />
        <Pop>
        <Card style={{ alignItems: 'center', gap: S.sm, paddingVertical: 26 }}>
          <H2 style={{ textAlign: 'center' }}>{t('session.shortQDone', { n: got, total: items.length })}</H2>
          <Small style={{ textAlign: 'center' }}>{t('session.shortQDoneSub')}</Small>
        </Card>
        </Pop>
        <Spacer h={S.lg} />
        {/* Down to the chapter underneath rather than a second copy on top. */}
        {chapterId ? (
          <Btn
            title={fromChapter ? t('session.backToChapter') : t('common.done')}
            onPress={() => leaveSet(fromChapter, chapterId)}
          />
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={t('practice.shortQ')} sub={t('session.shortQOf', { a: i + 1, b: items.length })} back />
      {ai ? null : <PracticeChapterBar kind="shortq" chapter={practice.chapter} />}
      <SegmentTrack
        segments={items.map((_, j) =>
          // 'partial' still earned something, so it reads as done, not wrong.
          marks[j] ? (marks[j] === 'missed' ? 'bad' : marks[j] === 'got' ? 'ok' : 'done') : j === i && !revealed ? 'current' : 'todo',
        )}
      />
      <Spacer h={S.md} />

      <Card>
        <Row gap={S.sm}>
          <Label style={{ color: C.teal }}>{t('session.shortQOf', { a: i + 1, b: items.length })}</Label>
          <Pill tone="grey">{t('session.marks', { n: item?.marks ?? 2 })}</Pill>
        </Row>
        <ScriptText text={item?.q ?? ''} face="display" size={17} style={{ marginTop: 8 }} />
      </Card>

      <Spacer h={S.md} />
      {!revealed ? (
        <>
          <Card flat tint={C.tealTint}>
            <Small>{t('session.thinkFirst')}</Small>
          </Card>
          <Spacer h={S.md} />
          {/* Write it like the paper, get it marked like the paper. */}
          <Card flat>
            <TextInput
              value={written}
              onChangeText={setWritten}
              placeholder={t('tutor.checkPlaceholder')}
              placeholderTextColor={C.ink3}
              multiline
              style={[
                // A written answer reads the way the rest of the screen reads.
                { fontFamily: F.body, fontSize: 14, lineHeight: 22, color: C.ink, minHeight: 96, textAlignVertical: 'top', textAlign: textStart() },
                // Typed in Urdu, it gets Nastaliq and its leading: at 22 the
                // lines of an Urdu answer overlapped and were cropped.
                isRTL() || isUrduScript(written) ? { fontFamily: F.urdu, lineHeight: 30 } : null,
                isWeb && ({ outlineStyle: 'none' } as object),
              ]}
            />
          </Card>
          <Spacer h={S.sm} />
          {/* Marking a written answer is the AI's job, so on Basic the student
              compares their answer with the model one themselves. */}
          {derived.access.ai ? (
            <>
              <Btn
                title={checking ? t('tutor.checkBusy') : t('tutor.checkTitle')}
                variant="orange"
                loading={checking}
                disabled={!written.trim()}
                onPress={checkMine}
              />
              <Spacer h={S.sm} />
              <Btn title={t('session.revealAnswer')} variant="line" onPress={() => setRevealed(true)} />
            </>
          ) : (
            <>
              <Btn title={t('session.revealAnswer')} onPress={() => setRevealed(true)} />
              <Spacer h={S.sm} />
              <Row gap={6}>
                <Icon name="lock" size={13} color={C.ink3} />
                <Small style={{ color: C.ink3, flex: 1 }}>{`${t('tutor.checkTitle')} · ${t('access.aiShort')}`}</Small>
              </Row>
            </>
          )}
        </>
      ) : (
        <>
          {verdict ? (
            <>
              <Card
                flat
                tint={verdict.score >= verdict.maxMarks ? C.greenTint : C.orangeTint}
                border={verdict.score >= verdict.maxMarks ? C.green : C.orange}
              >
                <Text style={{ fontFamily: F.display, fontSize: 19, color: C.ink }}>
                  {t('tutor.checkScore', { a: verdict.score, b: verdict.maxMarks })}
                </Text>
                <View style={{ marginTop: 6 }}><Markdown text={verdict.feedback} size={14} /></View>
                {verdict.missed.length ? (
                  <>
                    <Spacer h={S.sm} />
                    <Label style={{ color: C.orangeDark }}>{t('tutor.checkMissed')}</Label>
                    <View style={{ gap: 4, marginTop: 4 }}>
                      {verdict.missed.map((p, n) => (
                        <ScriptText key={n} text={`• ${p}`} size={13} color={C.ink2} />
                      ))}
                    </View>
                  </>
                ) : null}
                <ReportAi surface="check" refId={item?.id} excerpt={verdict.feedback} />
              </Card>
              <Spacer h={S.md} />
            </>
          ) : null}
          <Card flat tint={C.greenTint} border={C.green}>
            <Label style={{ color: C.green }}>{t('session.modelAnswer')}</Label>
            <View style={{ marginTop: 4 }}><Markdown text={item?.answer ?? ''} size={14} /></View>
            <Spacer h={S.sm} />
            <Label style={{ color: C.ink2 }}>{t('session.markingPoints')}</Label>
            <View style={{ gap: 4, marginTop: 4 }}>
              {item?.points.map((p, n) => (
                <ScriptText key={n} text={`• ${p}`} size={13} color={C.ink2} />
              ))}
            </View>
            {/* Google Play: the model answer and its marking points are
                written by the AI, a set asked for here and the bank alike. */}
            {item ? (
              <ReportAi surface="ai_test" refId={item.id} excerpt={`${item.q}\n\n${item.answer}\n\n${item.points.join('\n')}`} />
            ) : null}
          </Card>

          {derived.access.ai ? (
            <>
              <Spacer h={S.sm} />
              <Btn
                title={t('session.askAi')}
                variant="line"
                sm
                onPress={() =>
                  router.push(
                    // In the student's own language, not an English line they never wrote.
                    `/tutor/chat?q=${encodeURIComponent(t('session.askExplain', { q: item?.q ?? '' }))}${itemChapter ? `&chapter=${itemChapter}` : ''}`,
                  )
                }
              />
            </>
          ) : null}

          <Spacer h={S.lg} />
          <Label>{t('session.howDidYouDo')}</Label>
          <Spacer h={S.sm} />
          <Row gap={S.sm}>
            <View style={{ flex: 1 }}>
              <Btn title={t('session.gotIt')} variant="green" sm onPress={() => mark('got')} />
            </View>
            <View style={{ flex: 1 }}>
              <Btn title={t('session.partially')} variant="orange" sm onPress={() => mark('partial')} />
            </View>
            <View style={{ flex: 1 }}>
              <Btn title={t('session.missed')} variant="danger" sm onPress={() => mark('missed')} />
            </View>
          </Row>
          <Spacer h={S.sm} />
          <Small>{t('session.beHonest')}</Small>
        </>
      )}
    </Screen>
  );
}
