'use client';

import { useEffect, useState } from 'react';
import type { Blank, Chapter } from '@matricmate/core';
import { blankHalves, chapterName, isUrduScript } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { SessionHeader } from '@/components/app/SessionHeader';
import { Btn } from '@/components/ui/controls';
import { Card, Empty, Icon, LinkBtn, Pill, ScriptText } from '@/components/ui/primitives';
import { fireConfetti } from '@/lib/confetti';
import { useApp, useLang, useT } from '@/lib/store';
import { LeaveSetButton } from '@/components/app/LeaveSetButton';
import { PracticeChapterBar } from '@/components/app/PracticeChapterBar';
import { ReportAi } from '@/components/app/ReportAi';

export function BlanksScreen({ chapter, items, canChangeChapter }: { chapter: Chapter; items: Blank[]; canChangeChapter?: boolean }) {
  const { actions, derived } = useApp();
  const t = useT();
  const { lang } = useLang();
  /* The name a student reads, which is not the name an attempt is filed
     under: answers are filed under the chapter id (topicKey in core), so weak
     topics do not split in two across a language switch or between the two
     apps; the heading and the pill follow the app's language instead. Both
     come from the server: the client index is empty on a cold load for Class
     10 and Punjab, which filed every one of their attempts under a blank topic. */
  const chapterId = chapter.id;
  const name = chapterName(chapter, lang);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [right, setRight] = useState(0);
  // One mark per completed item, feeding the header's segments.
  const [marks, setMarks] = useState<('ok' | 'bad')[]>([]);

  const item = items[i];
  const done = items.length > 0 && i >= items.length;

  // The finish deserves a bang. No-op under reduced motion.
  useEffect(() => {
    if (done) fireConfetti(70);
  }, [done]);
  const correct = checked && pick === item?.answer;

  function check() {
    if (!item || !pick) return;
    const ok = pick === item.answer;
    setChecked(true);
    if (ok) setRight((r) => r + 1);
    setMarks((m) => [...m, ok ? 'ok' : 'bad']);
    actions.recordAttempt({
      mcqId: item.id,
      chapterId,
      subjectId: chapterId.split('-')[0],
      // The chapter's id, the one rule both apps file blanks under (see
      // topicKey in core). The title forked it: English here, the subject's
      // language on Android, so one chapter was two weak topics. Weak topics
      // show the chapter's name in the student's language.
      topic: chapterId,
      correct: ok,
      confidence: null,
      mode: 'blanks',
    });
  }

  // Nothing to fill in, which is not the same as having filled it all in.
  if (!items.length) {
    return (
      <Page width="focus">
        <PageHead back={`/learn/chapter/${chapterId}`} backLabel={name} title={t('practice.blanks')} />
        <Empty
          icon="edit"
          title={t('session.noItemsTitle')}
          sub={t('session.noItemsBody')}
          cta={<LeaveSetButton chapterId={chapterId} sm />}
        />
      </Page>
    );
  }

  if (done) {
    return (
      <Page width="focus">
        <PageHead back={`/learn/chapter/${chapterId}`} backLabel={name} title={t('practice.blanks')} />
        <Card className="flex flex-col items-center gap-2 py-7 text-center">
          <span
            className={`flex h-14 w-14 items-center justify-center rounded-full ${
              right === items.length ? 'bg-greentint text-green' : 'bg-tealtint text-teal'
            }`}
          >
            <Icon name={right === items.length ? 'party' : 'thumbsUp'} size={26} />
          </span>
          <p className="font-display text-[21px] text-ink">{t('session.blanksDone', { a: right, b: items.length })}</p>
          <p className="text-[13px] text-ink2">{t('session.blanksDoneSub')}</p>
        </Card>
        <LeaveSetButton chapterId={chapterId} variant="primary" className="mt-6 w-full" />
      </Page>
    );
  }

  const verdictLine = correct ? t('session.blanksCorrect') : t('session.blanksWrong', { a: item.answer });

  return (
    <Page width="focus">
      <h1 className="sr-only">{`${t('practice.blanks')} · ${name}`}</h1>
      <SessionHeader
        backHref={`/learn/chapter/${chapterId}`}
        backLabel={name}
        pct={(i / items.length) * 100}
        label={`${t('practice.blanks')} · ${t('session.blanksItem', { a: i + 1, b: items.length })}`}
        segments={items.map((_, j) => marks[j] ?? (j === i && !checked ? 'current' : 'todo'))}
        right={canChangeChapter ? undefined : <Pill tone="grey">{name}</Pill>}
      />
      {canChangeChapter ? <PracticeChapterBar kind="blanks" chapter={chapter} /> : null}

      {/* Same task frame as the MCQ and exam screens */}
      <div className="mt-4 md:rounded-[22px] md:border md:border-line md:bg-card md:p-7 md:shadow-[0_5px_14px_var(--shadow-soft)]">
      <Card className="md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        <p
          lang={isUrduScript(item.sentence.join('')) ? 'ur' : 'en'}
          dir={isUrduScript(item.sentence.join('')) ? 'rtl' : 'ltr'}
          className={
            isUrduScript(item.sentence.join(''))
              ? 'urdu text-[17px] text-ink'
              : 'text-start font-display text-[18px] leading-[1.9] text-ink md:text-[20px]'
          }
        >
          {blankHalves(item.sentence[0], item.sentence[1])[0]}
          <span
            className={`font-body font-extrabold underline ${
              checked ? (correct ? 'text-green' : 'text-red') : pick ? 'text-teal' : 'text-ink3'
            }`}
          >
            {pick ?? '_______'}
          </span>
          {blankHalves(item.sentence[0], item.sentence[1])[1]}
        </p>
      </Card>

      <div className="mt-4 flex flex-wrap gap-2">
        {item.options.map((o) => {
          const selected = pick === o;
          const isAnswer = o === item.answer;
          const tone = checked
            ? isAnswer
              ? 'bg-greentint text-green'
              : selected
                ? 'bg-redtint text-red'
                : 'bg-grey text-ink2'
            : selected
              ? 'bg-tealtint text-teal'
              : 'bg-grey text-ink2 hover:brightness-95';
          return (
            <button
              key={o}
              type="button"
              disabled={checked}
              aria-pressed={selected}
              onClick={() => setPick(o)}
              className={`min-h-11 rounded-full px-4 py-2.5 text-[13px] font-extrabold transition-colors duration-200 disabled:cursor-default ${tone}`}
            >
              <ScriptText text={o} className="" urduClassName="text-[13px]" />
            </button>
          );
        })}
      </div>
      </div>

      {checked ? (
        /* The verdict carries the answer, so it can be Urdu, and then the
           tick belongs where the line starts. Direction on the row, not a
           reversed row: in an Urdu account the page is already right to left,
           and reversing it put the tick at the far end. */
        <div dir={isUrduScript(verdictLine) ? 'rtl' : 'ltr'} className="mt-4">
          <Card
            flat
            tint={correct ? 'bg-greentint' : 'bg-redtint'}
            border={correct ? 'border-green' : 'border-red'}
            className="flex flex-wrap items-center gap-2.5"
          >
            <Icon name={correct ? 'check' : 'close'} size={18} strokeWidth={2.6} className={correct ? 'text-green' : 'text-red'} />
            {/* A basis wide enough that on a phone "Ask AI" drops to its own
                line, rather than squeezing the answer into a thin column. */}
            <ScriptText
              text={verdictLine}
              className={`min-w-0 flex-1 basis-56 text-[13.5px] font-extrabold ${correct ? 'text-green' : 'text-red'}`}
              urduClassName={`min-w-0 flex-1 basis-56 text-[13.5px] ${correct ? 'text-green' : 'text-red'}`}
            />
            {!correct && derived.access.ai ? (
              <LinkBtn
                title={t('session.askAi')}
                variant="line"
                sm
                className="shrink-0"
                href={`/tutor/chat?q=${encodeURIComponent(
                  t('session.askWhyBlank', { a: item.answer, before: item.sentence[0].trim(), after: item.sentence[1].trim() }),
                )}&chapter=${chapterId}`}
              />
            ) : null}
          </Card>
          {/* Written with AI, like the rest of the bank, so it can be reported. */}
          <ReportAi surface="ai_test" refId={item.id} excerpt={`${item.sentence[0]} ____ ${item.sentence[1]} · ${item.answer}`} />
        </div>
      ) : null}

      <div className="mt-6">
        {checked ? (
          <Btn
            title={i + 1 >= items.length ? t('session.seeResult') : t('common.next')}
            className="w-full"
            onClick={() => {
              setI(i + 1);
              setPick(null);
              setChecked(false);
            }}
          />
        ) : (
          <Btn title={t('session.blanksCheck')} onClick={check} disabled={!pick} className="w-full" />
        )}
      </div>
    </Page>
  );
}
