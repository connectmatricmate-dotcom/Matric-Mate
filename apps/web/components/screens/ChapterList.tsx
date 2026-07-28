'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Chapter, Subject } from '@matricmate/core';
import { chapterPct, subjectPct } from '@matricmate/core';
import { LockedNotice } from '@/components/app/LockedNotice';
import { Page, PageHead, Rail, Split, Work } from '@/components/app/Page';
import { UpgradeRail, WeakRail } from '@/components/app/rails';
import { Btn } from '@/components/ui/controls';
import { Bar, Card, Icon, LinkBtn, Pill, Ring, Ur } from '@/components/ui/primitives';
import { useApp, useT } from '@/lib/store';

export function ChapterList({ subject, chapters }: { subject: Subject; chapters: Chapter[] }) {
  const { state } = useApp();
  const t = useT();
  const [locked, setLocked] = useState<Chapter | null>(null);

  const pct = subjectPct(subject.id, state.readSections, state.attempts);

  const completed = chapters.filter((c) => chapterPct(c.id, state.readSections, state.attempts) >= 100).length;

  return (
    <Page>
      <PageHead
        back="/study"
        backLabel={t('study.title')}
        title={subject.name}
        urduTitle={subject.urduName ? <p className="mt-1"><Ur className="text-[15px] text-ink2">{subject.urduName}</Ur></p> : undefined}
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
          const p = chapterPct(c.id, state.readSections, state.attempts);
          const isLocked = c.premium && !state.premium.active;
          const current = c.id === state.lastChapterId;
          const done = p >= 100;

          const body = (
            <Card
              flat={!current}
              border={current ? 'border-teal' : undefined}
              className={`flex items-center gap-3 transition-colors duration-200 ${
                isLocked ? 'opacity-60' : 'hover:border-teal'
              }`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] font-display text-[16px] ${
                  done ? 'bg-greentint text-green' : 'bg-tealtint text-teal'
                }`}
              >
                {done ? <Icon name="check" size={19} strokeWidth={2.6} /> : c.number}
              </span>
              <span className="min-w-0 flex-1">
                {c.urduTitle ? <Ur className="text-ink2">{c.urduTitle}</Ur> : null}
                <span className="block text-[14px] font-extrabold text-ink">{c.title}</span>
                <span className="block truncate text-[13px] text-ink2">
                  {t('study.mcqsSub', { n: c.mcqCount })} · {t('study.audioSub', { n: c.audioMinutes })}
                </span>
                {p > 0 && p < 100 ? (
                  <span className="mt-2 block">
                    <Bar pct={p} tone="teal" />
                  </span>
                ) : null}
              </span>
              {isLocked ? (
                <Pill tone="grey" icon="lock">
                  {t('study.premiumChapter')}
                </Pill>
              ) : current ? (
                <Pill tone="orange">{t('common.continue')}</Pill>
              ) : (
                <Icon name="chevron" size={18} className="shrink-0 text-ink3" />
              )}
            </Card>
          );

          return isLocked ? (
            <button key={c.id} type="button" onClick={() => setLocked(c)} className="text-left">
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
                {completed} of {chapters.length} chapters done
              </p>
            </div>
          </Card>
          <WeakRail />
          <UpgradeRail />
        </Rail>
      </Split>

      {locked ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('billing.premium')}
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 md:items-center"
        >
          <Card className="w-full max-w-[440px]">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="flex-1 font-display text-[19px] text-ink">{locked.title}</h2>
              <button
                type="button"
                onClick={() => setLocked(null)}
                aria-label={t('common.close')}
                className="flex h-11 w-11 items-center justify-center rounded-[13px] text-ink2 hover:bg-paper"
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <LockedNotice body={t('billing.lockedBody')} cta={t('states.unlock')} />
            <Btn title={t('common.close')} variant="line" onClick={() => setLocked(null)} className="mt-3 w-full" />
          </Card>
        </div>
      ) : null}
    </Page>
  );
}
