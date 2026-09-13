'use client';

import { useEffect, useState } from 'react';
import { chapterName, checkAnswerLive, subjectMedium } from '@matricmate/core';
import type { AiCheckVerdict, Chapter, ShortQ } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { SessionHeader } from '@/components/app/SessionHeader';
import { Btn } from '@/components/ui/controls';
import { Card, Empty, Icon, Label, LinkBtn, Pill, ScriptText } from '@/components/ui/primitives';
import { ScriptBullets } from '@/components/ui/ScriptList';
import { useToast } from '@/components/ui/toast';
import { fireConfetti } from '@/lib/confetti';
import { useApp, useLang, useT } from '@/lib/store';
import { Markdown } from '@/components/ui/Markdown';
import { LeaveSetButton } from '@/components/app/LeaveSetButton';
import { PracticeChapterBar } from '@/components/app/PracticeChapterBar';

type Mark = 'got' | 'partial' | 'missed';

/**
 * Whether a check-answer reply is a verdict at all. A refusal used to arrive
 * as a success carrying `{ error }`, and reading `.missed.length` off it took
 * the whole screen down into the error boundary, losing the student's place.
 */
const isVerdict = (v: unknown): v is AiCheckVerdict =>
  !!v && typeof (v as AiCheckVerdict).score === 'number' && Array.isArray((v as AiCheckVerdict).missed);

export function ShortQScreen({ chapter, items, canChangeChapter }: { chapter: Chapter; items: ShortQ[]; canChangeChapter?: boolean }) {
  const { state, actions } = useApp();
  const t = useT();
  const { lang } = useLang();
  /* The name a student reads, which is not the name an attempt is filed
     under. The chapter's own title keeps feeding `topic`, so weak-topic stats
     do not split in two when somebody switches language; the heading follows
     the app's language instead. Both come from the server: the client index
     is empty on a cold load for Class 10 and Punjab, which filed every one of
     their attempts under a blank topic. */
  const chapterId = chapter.id;
  const name = chapterName(chapter, lang);
  const toast = useToast();
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [marks, setMarks] = useState<Mark[]>([]);
  /** The student's own written answer and the examiner's verdict on it. */
  const [written, setWritten] = useState('');
  const [checking, setChecking] = useState(false);
  const [verdict, setVerdict] = useState<AiCheckVerdict | null>(null);

  const item = items[i];
  const done = items.length > 0 && i >= items.length;

  // The finish deserves a bang. No-op under reduced motion.
  useEffect(() => {
    if (done) fireConfetti(70);
  }, [done]);

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
      // The subject's own language: English answers are marked in English
      // and Urdu ones in Urdu, whatever medium the student reads in.
      medium: subjectMedium(chapterId, chapter.board, state.settings.contentMedium),
    });
    setChecking(false);
    if (!res.ok) {
      const note = {
        offline: t('tutor.offline'),
        quota: t('tutor.limitToast'),
        rate: t('tutor.slowDown'),
        plan: t('tutor.planNeeded'),
        refused: t('tutor.refused'),
        syllabus: t('tutor.notInSyllabus'),
        error: t('tutor.errorReply'),
      }[res.reason];
      toast(note);
      return;
    }
    if (!isVerdict(res.verdict)) {
      toast(t('tutor.refused'));
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
      topic: chapter.title,
      correct: m === 'got',
      confidence: null,
      mode: 'shortq',
    });
    setRevealed(false);
    setWritten('');
    setVerdict(null);
    setI(i + 1);
  }

  // Nothing to answer, which is not the same as having answered it all.
  if (!items.length) {
    return (
      <Page width="focus">
        <PageHead back={`/learn/chapter/${chapterId}`} backLabel={name} title={t('practice.shortQ')} />
        <Empty
          icon="quill"
          title={t('session.noItemsTitle')}
          sub={t('session.noItemsBody')}
          cta={<LeaveSetButton chapterId={chapterId} sm />}
        />
      </Page>
    );
  }

  if (done) {
    const got = marks.filter((m) => m === 'got').length;
    return (
      <Page width="focus">
        <PageHead back={`/learn/chapter/${chapterId}`} backLabel={name} title={t('practice.shortQ')} />
        <Card className="flex flex-col items-center gap-2 py-7 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-tealtint text-teal">
            <Icon name="quill" size={26} />
          </span>
          <h2 className="font-display text-[22px] text-ink">{t('session.shortQDone', { n: got, total: items.length })}</h2>
          <p className="text-[13px] text-ink2">{t('session.shortQDoneSub')}</p>
        </Card>
        <LeaveSetButton chapterId={chapterId} variant="primary" className="mt-6 w-full" />
      </Page>
    );
  }

  return (
    <Page width="focus">
      <SessionHeader
        backHref={`/learn/chapter/${chapterId}`}
        backLabel={name}
        pct={(i / items.length) * 100}
        label={`${t('practice.shortQ')} · ${t('session.shortQOf', { a: i + 1, b: items.length })}`}
        segments={items.map((_, j) =>
          // 'partial' still earned something, so it reads as done, not wrong.
          marks[j] ? (marks[j] === 'missed' ? 'bad' : marks[j] === 'got' ? 'ok' : 'done') : j === i && !revealed ? 'current' : 'todo',
        )}
        right={<Pill tone="grey">{t('session.marks', { n: item.marks })}</Pill>}
      />
      {canChangeChapter ? <PracticeChapterBar kind="shortq" chapter={chapter} /> : null}

      {/* Same task frame as the MCQ and exam screens */}
      <div className="mt-4 md:rounded-[22px] md:border md:border-line md:bg-card md:p-7 md:shadow-[0_5px_14px_var(--shadow-soft)]">
      <Card flat className="md:border-0 md:bg-transparent md:p-0">
        <ScriptText text={item.q} className="font-display text-[17px] leading-[1.55] text-ink md:text-[20px]" urduClassName="text-[16px] text-ink" />
      </Card>

      {!revealed ? (
        <div className="mt-4">
          <Card flat tint="bg-tealtint" border="border-tealtint2">
            <p className="text-[13px] text-ink2">{t('session.thinkFirst')}</p>
          </Card>
          {/* Write it like the paper, get it marked like the paper. */}
          <div className="field-shell mt-4 rounded-[16px] border-[1.5px] border-line bg-card transition-[border-color,box-shadow] duration-200">
            <textarea
              value={written}
              onChange={(e) => setWritten(e.target.value)}
              placeholder={t('tutor.checkPlaceholder')}
              aria-label={t('tutor.checkPlaceholder')}
              rows={4}
              // 16px on phones, or iOS zooms the page in on focus and leaves it
              // there. Urdu needs Nastaliq's own leading.
              className="w-full resize-y bg-transparent p-4 text-[16px] leading-[1.6] text-ink outline-none placeholder:text-ink3 md:text-[14px] rtl:leading-[1.9]"
            />
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Btn
              title={checking ? t('tutor.checkBusy') : t('tutor.checkTitle')}
              variant="orange"
              className="flex-1"
              loading={checking}
              disabled={!written.trim()}
              onClick={() => void checkMine()}
            />
            <Btn title={t('session.revealAnswer')} variant="line" className="flex-1" onClick={() => setRevealed(true)} />
          </div>
        </div>
      ) : (
        <div className="mt-4">
          {verdict ? (
            <Card
              flat
              tint={verdict.score >= verdict.maxMarks ? 'bg-greentint' : 'bg-orangetint'}
              border={verdict.score >= verdict.maxMarks ? 'border-green' : 'border-orange'}
              className="mb-4"
            >
              <p className="font-display text-[19px] text-ink">{t('tutor.checkScore', { a: verdict.score, b: verdict.maxMarks })}</p>
              <Markdown text={verdict.feedback} className="mt-1.5 text-[14px] leading-[1.6] text-ink" />
              {verdict.missed.length ? (
                <div className="mt-3">
                  <Label className="text-orangedark">{t('tutor.checkMissed')}</Label>
                  <ScriptBullets items={verdict.missed} className="text-[13px] text-ink2" />
                </div>
              ) : null}
            </Card>
          ) : null}
          <Card flat tint="bg-greentint" border="border-green">
            <Label className="text-green">{t('session.modelAnswer')}</Label>
            <Markdown text={item.answer} className="mt-1 text-[14.5px] leading-[1.6] text-ink" />
            <div className="mt-3">
              <Label>{t('session.markingPoints')}</Label>
              <ScriptBullets items={item.points} className="text-[13px] text-ink2" />
            </div>
          </Card>

          <div className="mt-3">
            <LinkBtn
              title={t('session.askAi')}
              variant="line"
              sm
              href={`/tutor/chat?q=${encodeURIComponent(t('session.askExplain', { q: item.q }))}&chapter=${chapterId}`}
            />
          </div>

          <div className="mt-6">
            <Label>{t('session.howDidYouDo')}</Label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Btn title={t('session.gotIt')} variant="green" sm className="flex-1" onClick={() => mark('got')} />
              <Btn title={t('session.partially')} variant="orange" sm className="flex-1" onClick={() => mark('partial')} />
              <Btn title={t('session.missed')} variant="danger" sm className="flex-1" onClick={() => mark('missed')} />
            </div>
            <p className="mt-2 text-[13px] text-ink2">{t('session.beHonest')}</p>
          </div>
        </div>
      )}
      </div>
    </Page>
  );
}
