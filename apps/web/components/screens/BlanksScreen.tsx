'use client';

import { useState } from 'react';
import type { Blank } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Btn } from '@/components/ui/controls';
import { Bar, Card, Icon, LinkBtn } from '@/components/ui/primitives';
import { useApp, useT } from '@/lib/store';

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
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [right, setRight] = useState(0);

  const item = items[i];
  const done = i >= items.length;
  const correct = checked && pick === item?.answer;

  function check() {
    if (!item || !pick) return;
    const ok = pick === item.answer;
    setChecked(true);
    if (ok) setRight((r) => r + 1);
    actions.recordAttempt({
      mcqId: item.id,
      chapterId,
      subjectId: chapterId.split('-')[0],
      topic: t('practice.blanks'),
      correct: ok,
      confidence: null,
      mode: 'blanks',
    });
  }

  if (done) {
    return (
      <Page width="focus">
        <PageHead back={`/learn/chapter/${chapterId}`} backLabel={chapterTitle} title={t('practice.blanks')} />
        <Card className="flex flex-col items-center gap-2 py-7 text-center">
          <span className="text-[38px]">{right === items.length ? '🎉' : '👍'}</span>
          <p className="font-display text-[21px] text-ink">{t('session.blanksDone', { a: right, b: items.length })}</p>
          <p className="text-[13px] text-ink2">{t('session.blanksDoneSub')}</p>
        </Card>
        <LinkBtn title={t('session.backToChapter')} href={`/learn/chapter/${chapterId}`} className="mt-6 w-full" />
      </Page>
    );
  }

  return (
    <Page width="focus">
      <PageHead
        back={`/learn/chapter/${chapterId}`}
        backLabel={chapterTitle}
        title={t('practice.blanks')}
        sub={t('session.blanksItem', { a: i + 1, b: items.length })}
      />
      <Bar pct={(i / Math.max(1, items.length)) * 100} tone="teal" />

      <Card className="mt-6">
        <p className="font-display text-[18px] leading-[1.9] text-ink">
          {item.sentence[0]}
          <span
            className={`font-body font-extrabold underline ${
              checked ? (correct ? 'text-green' : 'text-red') : pick ? 'text-teal' : 'text-ink3'
            }`}
          >
            {pick ?? '_______'}
          </span>
          {item.sentence[1]}
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
              {o}
            </button>
          );
        })}
      </div>

      {checked ? (
        <Card
          flat
          tint={correct ? 'bg-greentint' : 'bg-redtint'}
          border={correct ? 'border-green' : 'border-red'}
          className="mt-4 flex items-center gap-2.5"
        >
          <Icon name={correct ? 'check' : 'close'} size={18} strokeWidth={2.6} className={correct ? 'text-green' : 'text-red'} />
          <p className={`flex-1 text-[13.5px] font-extrabold ${correct ? 'text-green' : 'text-red'}`}>
            {correct ? t('session.blanksCorrect') : t('session.blanksWrong', { a: item.answer })}
          </p>
        </Card>
      ) : null}

      <div className="sticky bottom-0 mt-5 bg-paper/95 py-4 backdrop-blur">
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
