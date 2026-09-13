'use client';

import { useEffect, useState } from 'react';
import type { Chapter, Flashcard } from '@matricmate/core';
import { chapterName } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { SessionHeader } from '@/components/app/SessionHeader';
import { Btn } from '@/components/ui/controls';
import { Card, Empty, Icon, Pill, ScriptText, Ur } from '@/components/ui/primitives';
import { fireConfetti } from '@/lib/confetti';
import { useApp, useLang, useT } from '@/lib/store';
import { LeaveSetButton } from '@/components/app/LeaveSetButton';
import { PracticeChapterBar } from '@/components/app/PracticeChapterBar';

export function FlashcardsScreen({ chapter, cards, canChangeChapter }: { chapter: Chapter; cards: Flashcard[]; canChangeChapter?: boolean }) {
  const { actions } = useApp();
  const t = useT();
  const { lang } = useLang();
  /* From the server, under the student's own session. The client index this
     used to read is empty on a cold load for Class 10 and Punjab, so the
     heading fell back to an English title. */
  const chapterId = chapter.id;
  const name = chapterName(chapter, lang);
  /* The cards in play. "Review repeats" narrows it to the ones marked for
     another go; it used to restart the whole deck, known cards and all. Kept
     as ids over the prop rather than a copy of it, so a language switch that
     re-fetches the cards still shows the new ones. */
  const [reviewing, setReviewing] = useState<string[] | null>(null);
  const review = reviewing ? cards.filter((c) => reviewing.includes(c.id)) : [];
  const deck = review.length ? review : cards;
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [repeats, setRepeats] = useState<string[]>([]);
  const [known, setKnown] = useState<string[]>([]);

  const card = deck[i];
  const done = deck.length > 0 && i >= deck.length;

  // The finish deserves a bang. No-op under reduced motion.
  useEffect(() => {
    if (done) fireConfetti(70);
  }, [done]);

  function mark(isKnown: boolean) {
    if (!card) return;
    actions.markCard(card.id, isKnown);
    if (isKnown) setKnown((k) => [...k, card.id]);
    else setRepeats((r) => [...r, card.id]);
    setFlipped(false);
    setI(i + 1);
  }

  /* Nothing to flip. A finished-set screen with confetti over "0 known, 0 to
     repeat" is what this used to show. */
  if (deck.length === 0) {
    return (
      <Page width="focus">
        <PageHead back={`/learn/chapter/${chapterId}`} backLabel={name} title={t('study.flashcards')} />
        <Empty
          icon="cards"
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
        <PageHead back={`/learn/chapter/${chapterId}`} backLabel={name} title={t('study.flashcards')} />
        <Card className="flex flex-col items-center gap-2 py-7 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-greentint text-green">
            <Icon name="party" size={26} />
          </span>
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
                setReviewing(repeats);
                setI(0);
                setRepeats([]);
                setKnown([]);
              }}
            />
          ) : null}
          <LeaveSetButton chapterId={chapterId} />
        </div>
      </Page>
    );
  }

  return (
    <Page width="focus">
      <SessionHeader
        backHref={`/learn/chapter/${chapterId}`}
        backLabel={name}
        pct={(i / deck.length) * 100}
        label={`${t('study.flashcards')} · ${t('session.cardOf', { a: i + 1, b: deck.length })}`}
        segments={deck.map((_, j) => (j < i ? 'done' : j === i ? 'current' : 'todo'))}
        right={canChangeChapter ? undefined : <Pill tone="grey">{name}</Pill>}
      />
      {canChangeChapter ? <PracticeChapterBar kind="cards" chapter={chapter} /> : null}

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
          {/* term. justify-center-safe: a long definition centred in a fixed
              box overflows upward, past the top, where no scrolling reaches. */}
          <span className="absolute inset-0 flex flex-col items-center justify-center-safe gap-3 overflow-y-auto rounded-[22px] border-[1.5px] border-line bg-card p-6 [backface-visibility:hidden]">
            <span className="text-[11px] font-extrabold tracking-[0.08em] text-ink2 rtl:tracking-normal">{t('session.cardTerm')}</span>
            <ScriptText text={card.front} className="text-center font-display text-[23px] text-ink" urduClassName="text-center text-[20px] text-ink" />
            <span className="text-[13px] text-ink2">{t('session.tapToFlip')}</span>
          </span>

          {/* definition */}
          <span className="absolute inset-0 flex flex-col items-center justify-center-safe gap-3 overflow-y-auto rounded-[22px] bg-teal p-6 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <span className="text-[11px] font-extrabold tracking-[0.08em] text-onbrand-soft rtl:tracking-normal">{t('session.cardDefinition')}</span>
            <ScriptText text={card.back} className="text-center text-[16px] leading-[1.6] text-onbrand" urduClassName="text-center text-[15px] text-onbrand" />
            {card.urduBack ? <Ur block className="block text-center text-[14px] text-onbrand-soft">{card.urduBack}</Ur> : null}
          </span>
        </span>
      </button>

      <div className="mt-4 flex justify-center gap-2">
        <Pill tone="green">{t('session.knownCount', { n: known.length })}</Pill>
        <Pill tone="orange">{t('session.repeatCount', { n: repeats.length })}</Pill>
      </div>

      <div className="mt-6 flex gap-2.5">
        <Btn title={t('session.repeat')} variant="line" className="flex-1" onClick={() => mark(false)} />
        <Btn title={t('session.known')} variant="green" className="flex-1" onClick={() => mark(true)} />
      </div>
    </Page>
  );
}
