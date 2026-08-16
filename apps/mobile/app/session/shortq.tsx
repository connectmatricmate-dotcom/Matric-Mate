import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Btn, Card, Empty, ErrorState, H2, Header, Label, Pill, Row, Screen, ScriptText, Skeleton, Small, Spacer, useToast } from '../../src/components/ui';
import { SegmentTrack } from '../../src/components/SessionHeader';
import { api, chapterById, chaptersFor, checkAnswerLive, fetchAiSession, normalizeAiShortQs } from '@matricmate/core';
import type { AiCheckVerdict } from '@matricmate/core';
import { useAsync } from '../../src/core/useAsync';
import { Confetti, Pop } from '../../src/components/celebration';
import { cheer } from '../../src/core/haptics';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, S, isWeb, textStart } from '../../src/theme';
import { Markdown } from '../../src/components/Markdown';

type Mark = 'got' | 'partial' | 'missed';

export default function ShortQuestions() {
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
      return { shortQs: normalizeAiShortQs(s.items as Parameters<typeof normalizeAiShortQs>[0], s.chapterId ?? chapterId) };
    }
    return api.getChapterContent(chapterId);
  }, [chapterId, ai ?? '']);

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
        <Header title={t('practice.shortQ')} back />
        <Spacer h={S.lg} />
        <ErrorState title={t('states.errorTitle')} sub={t('states.errorBody')} retry={t('common.retry')} onRetry={reload} />
      </Screen>
    );
  }
  if (!loading && content && items.length === 0) {
    return (
      <Screen>
        <Header title={t('practice.shortQ')} back />
        <Spacer h={S.lg} />
        <Empty title={t('session.noItemsTitle')} sub={t('session.noItemsBody')} />
      </Screen>
    );
  }
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
      medium: state.settings.contentMedium,
    });
    setChecking(false);
    if (!res.ok) {
      const note = {
        offline: t('tutor.offline'),
        quota: t('tutor.limitToast'),
        rate: t('tutor.slowDown'),
        plan: t('tutor.planNeeded'),
        refused: t('tutor.refused'),
        error: t('tutor.errorReply'),
      }[res.reason];
      toast(note);
      return;
    }
    setVerdict(res.verdict);
    setRevealed(true);
  }

  function mark(m: Mark) {
    if (!item) return;
    setMarks((prev) => [...prev, m]);
    actions.recordAttempt({
      mcqId: item.id,
      chapterId,
      subjectId: chapterId.split('-')[0],
      // The chapter's own title, not the name of the exercise. This used
      // to store the translated UI label, so Weak topics listed
      // "Fill in the blanks" as a syllabus topic, and switching language
      // forked it into a second one.
      topic: chapterById(chapterId)?.title ?? chapterId,
      correct: m === 'got',
      confidence: null,
      mode: 'shortq',
    });
    setRevealed(false);
    setWritten('');
    setVerdict(null);
    setI(i + 1);
  }

  if (loading) {
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
        <Btn title={t('session.backToChapter')} onPress={() => router.replace(`/learn/chapter/${chapterId}`)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={t('practice.shortQ')} sub={t('session.shortQOf', { a: i + 1, b: items.length })} back />
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
                isWeb && ({ outlineStyle: 'none' } as object),
              ]}
            />
          </Card>
          <Spacer h={S.sm} />
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
          </Card>

          <Spacer h={S.sm} />
          <Btn
            title={t('session.askAi')}
            variant="line"
            sm
            onPress={() => router.push(`/tutor/chat?q=${encodeURIComponent(`Explain this in easy words: ${item?.q ?? ''}`)}&chapter=${chapterId}`)}
          />

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
