import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { Btn, Card, ErrorState, H2, Header, Pill, Row, Screen, SectionTitle, Skeleton, Small, Spacer, Text } from '../../src/components/ui';
import { api, boardName, chapterById, chapterName, subjectById, subjectName, weakTopics } from '@matricmate/core';
import type { Mcq } from '@matricmate/core';
import { useAsync } from '../../src/core/useAsync';
import { useLang, useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { session } from '../../src/store/session';
import { C, F, S, rowDir } from '../../src/theme';

/** The subject most of a set's questions are from, by their chapter ids. */
function mainSubject(mcqs: Mcq[], fallback: string): string {
  const counts = new Map<string, number>();
  for (const m of mcqs) {
    const sid = m.chapterId ? m.chapterId.split('-')[0] : '';
    if (sid) counts.set(sid, (counts.get(sid) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
}

export default function ExamIntro() {
  const { subject, chapter, paper, ai, topics, chapters: chaptersParam, count: countParam } = useLocalSearchParams<{
    subject?: string;
    chapter?: string;
    paper?: string;
    ai?: string;
    topics?: string;
    /** The weak topics' own chapters, from the AI screen, so the set stays in them. */
    chapters?: string;
    count?: string;
  }>();
  const { state, derived, contentKey } = useApp();
  const t = useT();
  const { lang } = useLang();

  const isAi = ai === '1';
  /**
   * Which subject, when the link does not say: the Practice tab's timed test
   * tile names none. It used to fall to the first subject on the list, which
   * is Mathematics for everyone, with no way to pick another. Now the student
   * picks, starting from the subject today's plan is on.
   */
  const open = !subject && !chapter && !paper && !isAi;
  const [picked, setPicked] = useState(derived.plan[0]?.subjectId ?? derived.subjects[0] ?? 'phy');
  // A chapter id carries its subject, so a chapter the index has not named yet
  // still gives the right one.
  const subjectId = subject ?? (chapter ? (chapterById(chapter)?.subjectId ?? chapter.split('-')[0]) : undefined) ?? picked;
  // The AI screen's choices arrive as params; everything else stays a board
  // exam of up to 20 questions.
  const want = isAi && countParam ? Math.min(25, Math.max(5, Number(countParam) || 15)) : 20;

  /**
   * The set itself, drawn when the screen opens rather than on Start.
   *
   * The rules card promised "20 questions · 30 minutes" before anything was
   * fetched, and a chapter with 12 questions then ran 12 questions against a
   * 30 minute clock. Drawing first means the card states what the test is.
   * Keyed on the language, class and board too, so a switch draws again.
   */
  const set = useAsync(async () => {
    if (isAi) {
      // The topics the AI screen chose, else the student's weak topics, kept
      // to those topics' own chapters so the padding cannot wander into
      // another subject, or another board's bank.
      const weak = weakTopics(state.attempts).slice(0, 3);
      const aiTopics = topics ? topics.split('|').filter(Boolean) : weak.map((w) => w.topic);
      const chapterIds = chaptersParam ? chaptersParam.split('|').filter(Boolean) : weak.map((w) => w.chapterId).filter(Boolean);
      return api.generateTest(aiTopics, want, chapterIds.length ? { chapterIds } : { subjectId });
    }
    return api.getMcqs({
      chapterIds: chapter ? [chapter] : undefined,
      subjectId: chapter ? undefined : subjectId,
      count: want,
    });
  }, [isAi, topics ?? '', chaptersParam ?? '', chapter ?? '', subjectId, want, contentKey]);

  const mcqs = set.data ?? [];
  const count = mcqs.length;
  const minutes = Math.max(1, Math.round(count * 1.5));

  const best = state.results
    .filter((r) => r.subjectId === subjectId && r.mode === 'exam')
    .sort((a, b) => (b.total ? b.score / b.total : 0) - (a.total ? a.score / a.total : 0))[0];

  const label = isAi
    ? t('tutor.aiTestTitle')
    : paper
      ? `${boardName(state.onboarding?.board, lang)} ${paper}`
      : chapter
        ? chapterName(chapterById(chapter), lang)
        : subjectName(subjectById(subjectId), lang);

  function start() {
    if (!count) return;
    session.start({
      mode: 'exam',
      label: `${label} · ${t('session.examTitle')}`,
      // The result is filed under the subject the questions are from. Each
      // answer is filed under its own chapter's subject in the exam itself.
      subjectId: isAi ? mainSubject(mcqs, subjectId) : subjectId,
      chapterId: chapter ?? null,
      mcqs,
      durationSec: minutes * 60,
      aiGenerated: isAi,
    });
    router.replace('/session/exam');
  }

  return (
    <Screen
      footer={
        <Btn
          title={t('session.startExam')}
          variant="orange"
          onPress={start}
          loading={set.loading}
          disabled={!set.loading && !count}
        />
      }
    >
      <Header title={t('session.examTitle')} sub={label} back />

      {open ? (
        <>
          <SectionTitle>{t('session.subject')}</SectionTitle>
          <View style={{ flexDirection: rowDir(), flexWrap: 'wrap', gap: S.sm, marginBottom: S.md }}>
            {derived.subjects.map((sid) => (
              <Pill
                key={sid}
                tone={sid === subjectId ? 'teal' : 'grey'}
                onPress={() => setPicked(sid)}
                style={{ paddingVertical: 9, paddingHorizontal: 14 }}
              >
                {subjectName(subjectById(sid), lang) || sid}
              </Pill>
            ))}
          </View>
        </>
      ) : null}

      {set.loading ? (
        <Skeleton h={170} />
      ) : set.error ? (
        <ErrorState title={t('states.errorTitle')} sub={t('states.errorBody')} retry={t('common.retry')} onRetry={set.reload} />
      ) : !count ? (
        <Card flat style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Small style={{ textAlign: 'center' }}>{t('session.noQuestions')}</Small>
        </Card>
      ) : (
        <Card border={C.orange} style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Icon name="clock" size={34} color={C.orangeDark} />
          <H2 style={{ marginTop: 10, textAlign: 'center' }}>{t('session.examRules', { n: count, min: minutes })}</H2>
          <Small style={{ textAlign: 'center', marginTop: 2 }}>{t('session.examRulesSub')}</Small>
          <Row gap={S.sm} style={{ marginTop: S.md, flexWrap: 'wrap', justifyContent: 'center' }}>
            {best ? (
              <Pill tone="green">{t('session.best', { n: Math.round((best.score / best.total) * 100) })}</Pill>
            ) : (
              <Pill tone="grey">{t('session.firstAttempt')}</Pill>
            )}
            {/* No pause pill: the exam has no pause mechanism, and promising
                one here cost students who believed it their timer. */}
            {isAi ? <Pill tone="teal">{t('session.weakFocus')}</Pill> : null}
          </Row>
        </Card>
      )}

      <Spacer h={S.lg} />
      <Card flat>
        <Text style={{ fontFamily: F.bodyBold, fontSize: 13.5, color: C.ink }}>{t('session.beforeStart')}</Text>
        <View style={{ gap: 8, marginTop: 10 }}>
          {/* Only once the paper is known: while it loads, minutes is the
              floor of one, and the tip read "1 minute of focus". */}
          {count ? <Small>• {t('session.beforeStart1', { min: minutes })}</Small> : null}
          <Small>• {t('session.beforeStart2')}</Small>
        </View>
      </Card>
    </Screen>
  );
}
