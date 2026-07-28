'use client';

import { useState } from 'react';
import type { Flashcard } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Btn } from '@/components/ui/controls';
import { Bar, Card, LinkBtn, Pill, Ur } from '@/components/ui/primitives';
import { useApp, useT } from '@/lib/store';

export function FlashcardsScreen({
  chapterId,
  chapterTitle,
  cards,
}: {
  chapterId: string;
  chapterTitle: string;
  cards: Flashcard[];
}) {
  const { actions } = useApp();
  const t = useT();
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [repeats, setRepeats] = useState<string[]>([]);
  const [known, setKnown] = useState<string[]>([]);

  const card = cards[i];
  const done = i >= cards.length;

  function mark(isKnown: boolean) {
    if (!card) return;
    actions.markCard(card.id, isKnown);
    if (isKnown) setKnown((k) => [...k, card.id]);
    else setRepeats((r) => [...r, card.id]);
    setFlipped(false);
    setI(i + 1);
  }

  if (done) {
    return (
      <Page width="focus">
        <PageHead back={`/learn/chapter/${chapterId}`} backLabel={chapterTitle} title={t('study.flashcards')} />
        <Card className="flex flex-col items-center gap-2 py-7 text-center">
          <span className="text-[40px]">🎉</span>
          <h2 className="font-display text-[22px] text-ink">
            {t('session.cardsDone', { known: known.length, repeat: repeats.length })}
          </h2>
          <p className="text-[13px] text-ink2">{t('session.cardsDoneSub')}</p>
        </Card>
        <div className="mt-6 flex flex-col gap-2.5">
          {repeats.length ? (
            <Btn
              title={t('session.reviewRepeats', { n: repeats.length })}
              onClick={() => {
                setI(0);
                setRepeats([]);
                setKnown([]);
              }}
            />
          ) : null}
          <LinkBtn title={t('session.backToChapter')} href={`/learn/chapter/${chapterId}`} variant="line" />
        </div>
      </Page>
    );
  }

  return (
    <Page width="focus">
      <PageHead
        back={`/learn/chapter/${chapterId}`}
        backLabel={chapterTitle}
        title={t('study.flashcards')}
        sub={t('session.cardOf', { a: i + 1, b: cards.length })}
      />
      <Bar pct={(i / Math.max(1, cards.length)) * 100} tone="teal" />

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={t('session.tapToFlip')}
        className="mt-6 block h-[320px] w-full [perspective:1200px]"
      >
        <span
          className={`relative block h-full w-full transition-transform duration-300 ease-out [transform-style:preserve-3d] ${
            flipped ? '[transform:rotateY(180deg)]' : ''
          }`}
        >
          {/* term */}
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[22px] border-[1.5px] border-line bg-card p-6 [backface-visibility:hidden]">
            <span className="text-[11px] font-extrabold tracking-[0.08em] text-ink2">{t('session.cardTerm')}</span>
            <span className="text-center font-display text-[23px] text-ink">{card.front}</span>
            <span className="text-[13px] text-ink2">{t('session.tapToFlip')}</span>
          </span>

          {/* definition */}
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[22px] bg-teal p-6 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <span className="text-[11px] font-extrabold tracking-[0.08em] text-white/70">{t('session.cardDefinition')}</span>
            <span className="text-center text-[16px] leading-[1.6] text-white">{card.back}</span>
            {card.urduBack ? <Ur block className="block text-center text-[14px] text-white/85">{card.urduBack}</Ur> : null}
          </span>
        </span>
      </button>

      <div className="mt-4 flex justify-center gap-2">
        <Pill tone="green">{t('session.knownCount', { n: known.length })}</Pill>
        <Pill tone="orange">{t('session.repeatCount', { n: repeats.length })}</Pill>
      </div>

      <div className="sticky bottom-0 mt-5 flex gap-2.5 bg-paper/95 py-4 backdrop-blur">
        <Btn title={t('session.repeat')} variant="line" className="flex-1" onClick={() => mark(false)} />
        <Btn title={t('session.known')} variant="green" className="flex-1" onClick={() => mark(true)} />
      </div>
    </Page>
  );
}
