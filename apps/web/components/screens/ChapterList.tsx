'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Chapter, Subject } from '@matricmate/core';
import { chapterName, chapterPct, hasStudyMaterial, isUrduScript, subjectPct } from '@matricmate/core';
import { LockedNotice } from '@/components/app/LockedNotice';
import { Page, PageHead, Rail, Split, Work } from '@/components/app/Page';
import { UpgradeRail, WeakRail } from '@/components/app/rails';
import { Btn } from '@/components/ui/controls';
import { Bar, Card, Icon, LinkBtn, Pill, Ring, ScriptText, Ur } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { useApp, useLang, useT } from '@/lib/store';

export function ChapterList({ subject, chapters }: { subject: Subject; chapters: Chapter[] }) {
  const { state } = useApp();
  const t = useT();
  const { lang } = useLang();
  const [locked, setLocked] = useState<Chapter | null>(null);

  // One pass over the chapters per data change. The render below used to call
  // chapterPct twice per chapter (the completed count and each row) on every
  // store update; each call walks the full attempts history.
  const { pct, perChapter, completed } = useMemo(() => {
    const per = new Map(chapters.map((c) => [c.id, chapterPct(c.id, state.readSections, state.attempts)]));
    return {
      pct: subjectPct(subject.id, state.readSections, state.attempts),
      perChapter: per,
      completed: [...per.values()].filter((p) => p >= 100).length,
    };
  }, [chapters, subject.id, state.readSections, state.attempts]);

  return (
    <Page>
      <PageHead
        back="/study"
        backLabel={t('study.title')}
        title={state.settings.language === 'ur' && subject.urduName ? subject.urduName : subject.name}
        titleUrdu={state.settings.language === 'ur' && !!subject.urduName}
        sub={`${t('study.chapterCount', { n: chapters.length })} · ${t('study.percentComplete', { n: pct })}`}
        actions={
          <LinkBtn
            title={t('study.chapterTest')}
            href={`/session/exam-intro?subject=${subject.id}`}
            variant="orange"
            icon="clock"
            sm
          />
        }
      />

      <Split>
        <Work className="flex flex-col gap-2.5">
        {chapters.map((c) => {
          const empty = !hasStudyMaterial(c);
          const p = empty ? 0 : (perChapter.get(c.id) ?? 0);
          const isLocked = c.premium && !state.premium.active;
          const current = c.id === state.lastChapterId;
          const done = p >= 100;

          const body = (
            <Card
              flat={!current}
              border={current ? 'border-teal' : undefined}
              className={`transition-colors duration-200 ${empty ? 'opacity-60' : isLocked ? 'opacity-60' : 'hover:border-teal'}`}
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
                {empty ? null : (
                  <span className="block truncate text-[13px] text-ink2">
                    {/* Section count, not audio length, and the same three
                        facts the Android list shows. This read audioMinutes,
                        a denormalised column nothing populates, so every
                        chapter advertised a "0 min audio lesson" while the
                        chapter hub, which reads the audio_tracks row, showed
                        the real length. The share leads: it is the number the
                        board itself publishes and the one that decides study
                        order. */}
                    {c.examShare ? `${t('study.examShare', { n: c.examShare })} · ` : ''}
                    {t('study.mcqsSub', { n: c.mcqCount })} · {t('study.sectionsSub', { n: c.sectionCount })}
                  </span>
                )}
                {!empty && p > 0 && p < 100 ? (
                  <span className="mt-2 block">
                    <Bar pct={p} tone="teal" />
                  </span>
                ) : null}
              </span>
              {empty ? (
                <Pill tone="grey">{t('study.notOnPaper')}</Pill>
              ) : isLocked ? (
                <Pill tone="grey" icon="lock">
                  {t('study.premiumChapter')}
                </Pill>
              ) : current ? (
                <Pill tone="orange">{t('common.continue')}</Pill>
              ) : (
                <Icon name="chevron" size={18} className="shrink-0 text-ink3" />
              )}
                          </span>
              {empty ? (
                // The blurb takes the card's full width below the title row;
                // squeezed into the middle column it wrapped into a cramped
                // ribbon (client screenshot).
                <span className="mt-2 block">
                  {isUrduScript(c.blurb) ? (
                    <Ur block className="text-[13px] text-ink2">{c.blurb}</Ur>
                  ) : (
                    <span className="block text-[13px] text-ink2">{c.blurb}</span>
                  )}
                </span>
              ) : null}
            </Card>
          );

          if (empty) {
            return <div key={c.id}>{body}</div>;
          }

          return isLocked ? (
            <button key={c.id} type="button" onClick={() => setLocked(c)} className="text-start">
              {body}
            </button>
          ) : (
            <Link key={c.id} href={`/learn/chapter/${c.id}`}>
              {body}
            </Link>
          );
        })}

          <p className="mt-2 text-[13px] text-ink2">{t('study.premiumNote')}</p>
        </Work>

        <Rail>
          <Card flat className="flex items-center gap-4">
            <Ring pct={pct} size={68} stroke={8}>
              <span className="font-display text-[16px] text-ink tabular">{pct}%</span>
            </Ring>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-extrabold text-ink">{subject.name}</p>
              <p className="text-[12.5px] text-ink2">
                {t('study.chaptersDone', { done: completed, total: chapters.length })}
              </p>
            </div>
          </Card>
          <WeakRail />
          <UpgradeRail />
        </Rail>
      </Split>

      {/* The shared Sheet, not a hand-rolled overlay: it brings Escape, the
          focus trap, the scroll lock and the closable backdrop with it. */}
      <Sheet open={locked !== null} onClose={() => setLocked(null)} title={locked?.title ?? ''}>
        <LockedNotice body={t('billing.lockedBody')} cta={t('states.unlock')} />
        <Btn title={t('common.close')} variant="line" onClick={() => setLocked(null)} className="mt-3 w-full" />
      </Sheet>
    </Page>
  );
}
