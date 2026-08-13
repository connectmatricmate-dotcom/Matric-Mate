'use client';

import { useEffect, useState } from 'react';
import type { ShortQ } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { SessionHeader } from '@/components/app/SessionHeader';
import { Btn } from '@/components/ui/controls';
import { Card, Icon, Label, LinkBtn, Pill } from '@/components/ui/primitives';
import { fireConfetti } from '@/lib/confetti';
import { useApp, useT } from '@/lib/store';

type Mark = 'got' | 'partial' | 'missed';

export function ShortQScreen({
  chapterId,
  chapterTitle,
  items,
}: {
  chapterId: string;
  chapterTitle: string;
  items: ShortQ[];
}) {
  const { actions } = useApp();
  const t = useT();
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [marks, setMarks] = useState<Mark[]>([]);

  const item = items[i];
  const done = i >= items.length;

  // The finish deserves a bang. No-op under reduced motion.
  useEffect(() => {
    if (done) fireConfetti(70);
  }, [done]);

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

  if (done) {
    const got = marks.filter((m) => m === 'got').length;
    return (
      <Page width="focus">
        <PageHead back={`/learn/chapter/${chapterId}`} backLabel={chapterTitle} title={t('practice.shortQ')} />
        <Card className="flex flex-col items-center gap-2 py-7 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-tealtint text-teal">
            <Icon name="quill" size={26} />
          </span>
          <h2 className="font-display text-[22px] text-ink">{t('session.shortQDone', { n: got, total: items.length })}</h2>
          <p className="text-[13px] text-ink2">{t('session.shortQDoneSub')}</p>
        </Card>
        <LinkBtn title={t('session.backToChapter')} href={`/learn/chapter/${chapterId}`} className="mt-6 w-full" />
      </Page>
    );
  }

  return (
    <Page width="focus">
      <SessionHeader
        backHref={`/learn/chapter/${chapterId}`}
        backLabel={chapterTitle}
        pct={(i / Math.max(1, items.length)) * 100}
        label={`${t('practice.shortQ')} · ${t('session.shortQOf', { a: i + 1, b: items.length })}`}
        right={<Pill tone="grey">{t('session.marks', { n: item.marks })}</Pill>}
      />

      {/* Same task frame as the MCQ and exam screens */}
      <div className="mt-4 md:rounded-[22px] md:border md:border-line md:bg-card md:p-7 md:shadow-[0_5px_14px_rgba(15,80,100,0.07)]">
      <Card flat className="md:border-0 md:bg-transparent md:p-0">
        <p className="font-display text-[17px] leading-[1.55] text-ink md:text-[20px]">{item.q}</p>
      </Card>

      {!revealed ? (
        <div className="mt-4">
          <Card flat tint="bg-tealtint" border="border-tealtint2">
            <p className="text-[13px] text-ink2">{t('session.thinkFirst')}</p>
          </Card>
          <div className="mt-6">
            <Btn title={t('session.revealAnswer')} onClick={() => setRevealed(true)} className="w-full" />
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <Card flat tint="bg-greentint" border="border-green">
            <Label className="text-green">{t('session.modelAnswer')}</Label>
            <p className="mt-1 text-[14.5px] leading-[1.6] text-ink">{item.answer}</p>
            <div className="mt-3">
              <Label>{t('session.markingPoints')}</Label>
              <ul className="mt-1 flex flex-col gap-1">
                {item.points.map((p, n) => (
                  <li key={n} className="text-[13px] text-ink2">
                    • {p}
                  </li>
                ))}
              </ul>
            </div>
          </Card>

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
