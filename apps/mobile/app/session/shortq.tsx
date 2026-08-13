import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Body, Btn, Card, Empty, ErrorState, H2, Header, Label, Pill, Row, Screen, Skeleton, Small, Spacer } from '../../src/components/ui';
import { api, chaptersFor } from '@matricmate/core';
import { useAsync } from '../../src/core/useAsync';
import { Confetti, Pop } from '../../src/components/celebration';
import { cheer } from '../../src/core/haptics';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, S } from '../../src/theme';

type Mark = 'got' | 'partial' | 'missed';

export default function ShortQuestions() {
  const { chapter } = useLocalSearchParams<{ chapter?: string }>();
  const { state, actions } = useApp();
  // Arriving with no chapter param used to mean Physics chapter 3 for
  // everyone. Follow the student instead: the chapter they last studied,
  // else the first chapter of their first subject.
  const chapterId = chapter ?? state.lastChapterId ?? chaptersFor(state.onboarding?.subjects?.[0] ?? 'phy')[0]?.id ?? 'phy-1';
  const t = useT();
  const { data: content, loading, error, reload } = useAsync(() => api.getChapterContent(chapterId), [chapterId]);

  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [marks, setMarks] = useState<Mark[]>([]);

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
  function mark(m: Mark) {
    if (!item) return;
    setMarks((prev) => [...prev, m]);
    actions.recordAttempt({
      mcqId: item.id,
      chapterId,
      subjectId: chapterId.split('-')[0],
      topic: t('practice.shortQ'),
      correct: m === 'got',
      confidence: null,
      mode: 'shortq',
    });
    setRevealed(false);
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

      <Card>
        <Row gap={S.sm}>
          <Label style={{ color: C.teal }}>{t('session.shortQOf', { a: i + 1, b: items.length })}</Label>
          <Pill tone="grey">{t('session.marks', { n: item?.marks ?? 2 })}</Pill>
        </Row>
        <Text style={{ fontFamily: F.display, fontSize: 17, lineHeight: 26, color: C.ink, marginTop: 8 }}>{item?.q}</Text>
      </Card>

      <Spacer h={S.md} />
      {!revealed ? (
        <>
          <Card flat tint={C.tealTint}>
            <Small>{t('session.thinkFirst')}</Small>
          </Card>
          <Spacer h={S.md} />
          <Btn title={t('session.revealAnswer')} onPress={() => setRevealed(true)} />
        </>
      ) : (
        <>
          <Card flat tint={C.greenTint} border={C.green}>
            <Label style={{ color: C.green }}>{t('session.modelAnswer')}</Label>
            <Body style={{ marginTop: 4 }}>{item?.answer}</Body>
            <Spacer h={S.sm} />
            <Label style={{ color: C.ink2 }}>{t('session.markingPoints')}</Label>
            <View style={{ gap: 4, marginTop: 4 }}>
              {item?.points.map((p, n) => (
                <Small key={n}>• {p}</Small>
              ))}
            </View>
          </Card>

          <Spacer h={S.sm} />
          <Btn
            title={t('session.askAi')}
            variant="line"
            sm
            onPress={() => router.push(`/tutor/chat?q=${encodeURIComponent(`Explain this in easy words: ${item?.q ?? ''}`)}`)}
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
