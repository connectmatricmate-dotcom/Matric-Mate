'use client';

import { useEffect, useState } from 'react';
import type { Blank } from '@matricmate/core';
import { blankHalves, chapterById, chapterName, isUrduScript } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { SessionHeader } from '@/components/app/SessionHeader';
import { Btn } from '@/components/ui/controls';
import { Card, Icon, LinkBtn, Pill, ScriptText } from '@/components/ui/primitives';
import { fireConfetti } from '@/lib/confetti';
import { useApp, useLang, useT } from '@/lib/store';

export function BlanksScreen({
  chapterId,
  chapterTitle,
  items,
}: {
  chapterId: string;
  chapterTitle: string;
  items: Blank[];
}) {
  const { actions } = useApp();
  const t = useT();
  const { lang } = useLang();
  /* The name a student reads, which is not the name an attempt is filed
     under. `chapterTitle` comes from the server in English and keeps feeding
     `topic` so weak-topic stats do not split in two when somebody switches
     language; the heading and the pill follow the app's language instead. */
  const chapter = chapterById(chapterId);
  const name = chapter ? chapterName(chapter, lang) : chapterTitle;
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [right, setRight] = useState(0);
  // One mark per completed item, feeding the header's segments.
  const [marks, setMarks] = useState<('ok' | 'bad')[]>([]);

  const item = items[i];
  const done = i >= items.length;

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
      // The chapter's own title, not the name of the exercise. This used
      // to store the translated UI label, so Weak topics listed
      // "Fill in the blanks" as a syllabus topic, and switching language
      // forked it into a second one.
      topic: chapterTitle,
      correct: ok,
      confidence: null,
      mode: 'blanks',
    });
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
        <LinkBtn title={t('session.backToChapter')} href={`/learn/chapter/${chapterId}`} className="mt-6 w-full" />
      </Page>
    );
  }

  const verdictLine = correct ? t('session.blanksCorrect') : t('session.blanksWrong', { a: item.answer });

  return (
    <Page width="focus">
      <SessionHeader
        backHref={`/learn/chapter/${chapterId}`}
        backLabel={name}
        pct={(i / Math.max(1, items.length)) * 100}
        label={`${t('practice.blanks')} · ${t('session.blanksItem', { a: i + 1, b: items.length })}`}
        segments={items.map((_, j) => marks[j] ?? (j === i && !checked ? 'current' : 'todo'))}
        right={<Pill tone="grey">{name}</Pill>}
      />

      {/* Same task frame as the MCQ and exam screens */}
      <div className="mt-4 md:rounded-[22px] md:border md:border-line md:bg-card md:p-7 md:shadow-[0_5px_14px_var(--shadow-soft)]">
      <Card className="md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        <p
          lang={isUrduScript(item.sentence.join('')) ? 'ur' : undefined}
          dir={isUrduScript(item.sentence.join('')) ? 'rtl' : undefined}
          className={
            isUrduScript(item.sentence.join(''))
              ? 'urdu text-[17px] text-ink'
              : 'font-display text-[18px] leading-[1.9] text-ink md:text-[20px]'
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
        <Card
          flat
          tint={correct ? 'bg-greentint' : 'bg-redtint'}
          border={correct ? 'border-green' : 'border-red'}
          /* The verdict carries the answer, so it can be Urdu. Then the tick
             belongs where the line starts, on the right. */
          className={`mt-4 flex items-center gap-2.5 ${isUrduScript(verdictLine) ? 'flex-row-reverse' : ''}`}
        >
          <Icon name={correct ? 'check' : 'close'} size={18} strokeWidth={2.6} className={correct ? 'text-green' : 'text-red'} />
          <ScriptText
            text={verdictLine}
            className={`flex-1 text-[13.5px] font-extrabold ${correct ? 'text-green' : 'text-red'}`}
            urduClassName={`flex-1 text-[13.5px] ${correct ? 'text-green' : 'text-red'}`}
          />
          {!correct ? (
            <LinkBtn
              title={t('session.askAi')}
              variant="line"
              sm
              href={`/tutor/chat?q=${encodeURIComponent(`Why does "${item.answer}" fit here: "${item.sentence[0]} ____ ${item.sentence[1]}"?`)}&chapter=${chapterId}`}
            />
          ) : null}
        </Card>
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
