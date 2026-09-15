'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { Chapter, Subject } from '@matricmate/core';
import { chapterBlurb, chapterName, chapterPct, hasStudyMaterial, isUrduScript, offPaper, subjectName, subjectPct } from '@matricmate/core';
import { LockedNotice } from '@/components/app/LockedNotice';
import { Page, PageHead, Rail, Split, Work } from '@/components/app/Page';
import { WeakRail } from '@/components/app/rails';
import { Bar, Card, Icon, LinkBtn, Pill, Ring, ScriptText, Ur } from '@/components/ui/primitives';
import { useApp, useLang, useT } from '@/lib/store';

/*
 * No per-chapter lock decided in the browser, and no upgrade card in the rail.
 * Every chapter is premium and the (app) layout turns away anyone without a
 * plan, so the only student who ever saw the lock was a paying one on a cold
 * load, before the browser had re-read their plan: every chapter greyed out,
 * and a tap on one opened a checkout for a subscription they already had.
 * `paid` comes from the server instead, for a plan that ran out while the app
 * was open.
 */
export function ChapterList({ subject, chapters, paid }: { subject: Subject; chapters: Chapter[]; paid: boolean }) {
  const { state, derived } = useApp();
  const t = useT();
  const { lang } = useLang();

  // One pass over the chapters per data change. The render below used to call
  // chapterPct twice per chapter (the completed count and each row) on every
  // store update; each call walks the full attempts history.
  const { pct, perChapter, completed } = useMemo(() => {
    // Also when the chapter index lands or changes: chapterPct reads each
    // chapter's section and question counts from it.
    void derived.contentReady;
    const per = new Map(chapters.map((c) => [c.id, chapterPct(c.id, state.readSections, state.attempts)]));
    return {
      pct: subjectPct(subject.id, state.readSections, state.attempts),
      perChapter: per,
      completed: [...per.values()].filter((p) => p >= 100).length,
    };
  }, [chapters, subject.id, state.readSections, state.attempts, derived.contentReady]);

  const name = subjectName(subject, lang);

  return (
    <Page>
      <PageHead
        back="/study"
        backLabel={t('study.title')}
        title={name}
        titleUrdu={isUrduScript(name)}
        sub={`${t('study.chapterCount', { n: chapters.length })} · ${t('study.percentComplete', { n: pct })}`}
        // No test on a subject the plan does not open: the button only led
        // back to this page. The notice below says why.
        actions={
          paid ? (
            <LinkBtn
              title={t('study.subjectTest')}
              href={`/session/exam-intro?subject=${subject.id}`}
              variant="orange"
              icon="clock"
              sm
            />
          ) : undefined
        }
      />

      <Split>
        <Work className="flex flex-col gap-2.5">
        {/* Without a plan, row level security reports every chapter as having
            no material, so none is marked "not on the paper" and no counts
            show: the notice says what is actually wrong. */}
        {paid ? null : <LockedNotice body={t('billing.lockedBody')} cta={t('states.unlock')} />}
        {chapters.map((c) => {
          const empty = paid && !hasStudyMaterial(c);
          const p = empty ? 0 : (perChapter.get(c.id) ?? 0);
          const current = c.id === state.lastChapterId;
          const done = p >= 100;
          /* The blurb only explains an empty chapter. The translated one in
             the Urdu interface; where there is none yet, nothing, since an
             English sentence under an Urdu title reads as a mistake. */
          const rawBlurb = chapterBlurb(c, lang);
          const blurb = lang === 'ur' && !isUrduScript(rawBlurb) ? '' : rawBlurb;

          const body = (
            <Card
              flat={!current}
              border={current ? 'border-teal' : undefined}
              className={`transition-colors duration-200 ${empty ? 'opacity-60' : paid ? 'hover:border-teal' : ''}`}
            >
              <span className="flex items-center gap-3">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] font-display text-[16px] ${
                  empty ? 'bg-grey text-ink3' : done ? 'bg-greentint text-green' : 'bg-tealtint text-teal'
                }`}
              >
                {done ? <Icon name="check" size={19} strokeWidth={2.6} /> : c.number}
              </span>
              <span className="min-w-0 flex-1">
                <ScriptText text={chapterName(c, lang)} className="text-[14px] font-extrabold text-ink" />
                {empty || !paid ? null : (
                  // Wraps rather than truncating: on a phone the section count
                  // at the end of this line was always cut off.
                  <span className="block text-[13px] text-ink2">
                    {/* Section count, not audio length, and the same three
                        facts the Android list shows. This read audioMinutes,
                        a denormalised column nothing populates, so every
                        chapter advertised a "0 min audio lesson" while the
                        chapter hub, which reads the audio_tracks row, showed
                        the real length. The share leads: it is the number the
                        board itself publishes and the one that decides study
                        order. */}
                    {/* Each figure held to its word, so a narrow row breaks at a
                        dot and never leaves "sections" alone on the next line. */}
                    {[
                      // Whole numbers: "6.48%" claimed more precision than the
                      // board's table has. A chapter it gives no share is said so.
                      c.examShare ? t('study.examShare', { n: Math.round(c.examShare) }) : offPaper(c) ? t('study.notOnPaper') : '',
                      t('study.mcqsSub', { n: c.mcqCount }),
                      t('study.sectionsSub', { n: c.sectionCount }),
                    ]
                      .filter(Boolean)
                      .map((part) => part.replace(/ /g, '\u00A0'))
                      .join(' · ')}
                  </span>
                )}
                {!empty && p > 0 && p < 100 ? (
                  <span className="mt-2 block">
                    <Bar pct={p} tone="teal" />
                  </span>
                ) : null}
              </span>
              {empty ? (
                // Beside the title from sm up; under it on a phone, where a
                // pill this long squeezed the title into a narrow column.
                <Pill tone="grey" className="shrink-0 whitespace-nowrap max-sm:hidden">
                  {t('study.notOnPaper')}
                </Pill>
              ) : !paid ? (
                // Shut on this plan: a lock, not a chevron promising a way in.
                <Icon name="lock" size={16} className="shrink-0 text-ink3" />
              ) : current ? (
                <Pill tone="orange" className="shrink-0 whitespace-nowrap">{t('common.continue')}</Pill>
              ) : (
                <Icon name="chevron" size={18} className="shrink-0 text-ink3" />
              )}
              </span>
              {empty ? (
                // The blurb takes the card's full width below the title row;
                // squeezed into the middle column it wrapped into a cramped
                // ribbon (client screenshot).
                <span className="mt-2 block">
                  <Pill tone="grey" className="mb-1.5 sm:hidden">
                    {t('study.notOnPaper')}
                  </Pill>
                  {blurb ? (
                    isUrduScript(blurb) ? (
                      <Ur block className="text-[13px] text-ink2">{blurb}</Ur>
                    ) : (
                      <span className="block text-[13px] text-ink2">{blurb}</span>
                    )
                  ) : null}
                </span>
              ) : null}
            </Card>
          );

          // Not a link when there is nothing behind it: an empty chapter, or
          // one the plan does not open (its hub only repeats the lock above).
          return empty || !paid ? (
            <div key={c.id}>{body}</div>
          ) : (
            <Link key={c.id} href={`/learn/chapter/${c.id}`}>
              {body}
            </Link>
          );
        })}
        </Work>

        <Rail>
          <Card flat className="flex items-center gap-4">
            <Ring pct={pct} size={68} stroke={8}>
              <span className="font-display text-[16px] text-ink tabular">{pct}%</span>
            </Ring>
            <div className="min-w-0 flex-1">
              {/* In the student's language, like the page title above it. */}
              <ScriptText text={name} className="text-[13.5px] font-extrabold text-ink" urduClassName="text-[13.5px] text-ink" />
              <p className="text-[12.5px] text-ink2">
                {t('study.chaptersDone', { done: completed, total: chapters.length })}
              </p>
            </div>
          </Card>
          <WeakRail />
        </Rail>
      </Split>
    </Page>
  );
}
