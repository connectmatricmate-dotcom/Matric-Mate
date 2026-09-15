'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  api,
  boardName,
  chapterById,
  chapterName,
  isUrduScript,
  subjectById,
  subjectName,
  weakTopics,
  type Chapter,
  type Subject,
} from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Btn, PillButton } from '@/components/ui/controls';
import { Card, Icon, Pill, SectionTitle } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { useApp, useLang, useT } from '@/lib/store';
import { session } from '@/lib/session';

const COUNT = 20;
/** A minute and a half a question, as the Android app allows: 30 minutes for
 *  the usual 20, and a ten-question chapter is not given the same half hour. */
const minutesFor = (n: number) => Math.max(1, Math.round(n * 1.5));

export function ExamIntro({
  subject,
  chapter,
  paper,
  ai,
  topics,
}: {
  /** Checked against the student's syllabus on the server. */
  subject?: Subject;
  chapter?: Chapter;
  paper?: string;
  ai?: boolean;
  /** The weak topics the student ticked on the AI test screen. */
  topics?: string[];
}) {
  const { state, derived } = useApp();
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  /*
   * Which subject, when the link does not say: the Practice tab's timed test
   * names none. It was always the first on the list (Mathematics for most),
   * with no way to pick another. The student picks now, as on Android,
   * starting from the subject today's plan is on.
   */
  const open = !subject && !chapter && !paper && !ai;
  const [picked, setPicked] = useState<string | null>(null);
  const planSubject = derived.plan[0]?.subjectId;
  const choice = picked && derived.subjects.includes(picked) ? picked : planSubject && derived.subjects.includes(planSubject) ? planSubject : derived.subjects[0];
  const subjectId = subject?.id ?? chapter?.subjectId ?? choice ?? 'phy';

  /* A weak-topic paper spans subjects, so a best score filed under one of
     them would be some other test's. Only real paper results count, too: a
     0/0 left by an empty test divided into NaN here. */
  const best = ai
    ? undefined
    : state.results
        .filter((r) => r.subjectId === subjectId && r.mode === 'exam' && r.total > 0)
        .sort((a, b) => b.score / b.total - a.score / a.total)[0];

  /*
   * How many questions the test will really have. A chapter test is drawn
   * from that chapter alone, and a chapter with ten questions was promised
   * "20 questions" here and then handed ten. The browser's chapter index knows
   * the count in the student's medium; until it has loaded, or for a subject
   * or weak-topic paper, the standard size stands. The store re-renders this
   * screen when the index arrives, so the number corrects itself.
   */
  const inChapter = chapter ? chapterById(chapter.id)?.mcqCount : undefined;
  const count = inChapter ? Math.min(COUNT, inChapter) : COUNT;

  const label = ai
    ? t('tutor.aiTestTitle')
    : paper
      ? `${boardName(state.onboarding?.board, lang)} ${paper}`
      : chapter
        ? chapterName(chapter, lang)
        : subjectName(subject ?? subjectById(subjectId), lang);

  async function start() {
    setBusy(true);
    /* The picked topics arrive from the AI test screen; when someone lands
       here directly, fall back to their actual weakest topics. MCQ attempts
       only: blanks and short questions are filed under a chapter's title,
       which is never an MCQ topic, so they matched nothing and the "weak
       topic" paper was padded out with whatever came first. */
    const focus = topics?.length
      ? topics
      : weakTopics(state.attempts.filter((a) => a.mode === 'practice' || a.mode === 'exam'))
          .map((w) => w.key)
          .filter(Boolean)
          .slice(0, 3);
    /* Where the questions may come from. A chapter's or subject's test stays
       inside it; a weak-topic paper stays inside the chapters those topics
       were missed in. Unscoped, the generator padded the paper out with
       questions from anywhere in the syllabus. */
    const focusChapters = [
      ...new Set(state.attempts.filter((a) => a.chapterId && focus.includes(a.topic)).map((a) => a.chapterId)),
    ];
    const scope = chapter
      ? { chapterIds: [chapter.id] }
      : subject || open
        ? { subjectId }
        : focusChapters.length
          ? { chapterIds: focusChapters }
          : undefined;
    const mcqs = ai
      ? await api.generateTest(focus, COUNT, scope)
      : await api.getMcqs({
          chapterIds: chapter ? [chapter.id] : undefined,
          subjectId: chapter ? undefined : subjectId,
          count: COUNT,
        });
    /* A paper with no questions is not a paper. It used to start anyway: an
       empty screen with a 30 minute clock that then saved a 0/0 result. */
    if (!mcqs.length) {
      setBusy(false);
      toast(t('session.noQuestions'));
      return;
    }
    // busy stays true through router.replace: re-enabling the button while the
    // route transition runs is the double-click window.
    session.start({
      mode: 'exam',
      label: `${label} · ${t('session.examTitle')}`,
      subjectId,
      chapterId: chapter?.id ?? null,
      mcqs,
      durationSec: minutesFor(mcqs.length) * 60,
      aiGenerated: ai,
    });
    router.replace('/session/exam');
  }

  return (
    <Page width="focus">
      <PageHead back="/practice" backLabel={t('practice.title')} title={t('session.examTitle')} sub={label} subUrdu={isUrduScript(label)} />

      {open && derived.subjects.length > 1 ? (
        <>
          <SectionTitle>{t('session.subject')}</SectionTitle>
          <div className="-mt-1 mb-5 flex flex-wrap gap-2">
            {derived.subjects.map((sid) => (
              <PillButton key={sid} tone={sid === subjectId ? 'teal' : 'grey'} pressed={sid === subjectId} onClick={() => setPicked(sid)}>
                {subjectName(subjectById(sid), lang) || sid}
              </PillButton>
            ))}
          </div>
        </>
      ) : null}

      <Card border="border-orange" className="flex flex-col items-center py-6 text-center">
        <Icon name="clock" size={34} className="text-orangedark" />
        <h2 className="mt-2.5 font-display text-[21px] text-ink">{t('session.examRules', { n: count, min: minutesFor(count) })}</h2>
        <p className="mt-0.5 text-[13px] text-ink2">{t('session.examRulesSub')}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {best ? (
            <Pill tone="green">{t('session.best', { n: Math.round((best.score / best.total) * 100) })}</Pill>
          ) : ai ? null : (
            <Pill tone="grey">{t('session.firstAttempt')}</Pill>
          )}
          <Pill tone="orange">{t('session.pauseOnce')}</Pill>
          {ai ? <Pill tone="teal">{t('session.weakFocus')}</Pill> : null}
        </div>
      </Card>

      <Card flat className="mt-6">
        <p className="text-[13.5px] font-extrabold text-ink">{t('session.beforeStart')}</p>
        <ul className="mt-2.5 flex flex-col gap-2 text-[13px] text-ink2">
          <li>• {t('session.beforeStart1', { min: minutesFor(count) })}</li>
          <li>• {t('session.beforeStart2')}</li>
          <li>• {t('session.beforeStart3')}</li>
        </ul>
      </Card>

      <div className="mt-6">
        <Btn title={t('session.startExam')} variant="orange" onClick={start} loading={busy} className="w-full" />
      </div>
    </Page>
  );
}
