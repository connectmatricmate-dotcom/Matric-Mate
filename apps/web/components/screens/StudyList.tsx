'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { SUBJECT_COLORS, SUBJECT_ICON, type Chapter, type Subject, hasStudyMaterial, subjectPct } from '@matricmate/core';
import { Page, PageHead, Rail, Split, Work } from '@/components/app/Page';
import { CoverageRail, UpgradeRail, WeakRail } from '@/components/app/rails';
import { Bar, Card, Empty, Icon, Skeleton, Ur } from '@/components/ui/primitives';
import { useApp, useT } from '@/lib/store';

export function StudyListSkeleton() {
  return (
    <Page>
      <div className="mb-5">
        <Skeleton className="mb-2 h-3 w-40" />
        <Skeleton className="h-8 w-32" />
      </div>
      <Split>
        <Work>
          <Skeleton className="mb-4 h-[50px] w-full rounded-[14px]" />
          <div className="grid gap-3 md:grid-cols-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Card key={i} flat className="flex items-center gap-3">
                <Skeleton className="h-[52px] w-[52px] rounded-[16px]" />
                <div className="flex-1">
                  <Skeleton className="mb-2 h-3.5 w-3/5" />
                  <Skeleton className="h-2.5 w-2/5" />
                </div>
              </Card>
            ))}
          </div>
        </Work>
        <Rail>
          <Skeleton className="h-[104px] w-full rounded-[16px]" />
          <Skeleton className="h-[150px] w-full rounded-[16px]" />
        </Rail>
      </Split>
    </Page>
  );
}

export function StudyList({
  subjects,
  chaptersBySubject,
}: {
  subjects: Subject[];
  chaptersBySubject: Record<string, Chapter[]>;
}) {
  const { state, derived } = useApp();
  const t = useT();
  const [q, setQ] = useState('');

  const setup = state.onboarding;
  const eyebrow = setup
    ? t('study.setupLine', {
        class: setup.classLevel,
        board: setup.board === 'fbise' ? 'FBISE' : 'Punjab Board',
        medium: setup.medium === 'en' ? 'English' : 'Urdu',
      })
    : undefined;

  // Two memos on purpose. The progress sweep (subjectPct across every subject)
  // is the expensive half and depends only on study data; the search filter is
  // the cheap half and is the only part keyed on `q`. One combined memo re-ran
  // the whole sweep on every keystroke.
  const base = useMemo(
    () =>
      subjects
        .filter((s) => derived.subjects.includes(s.id))
        .map((s) => {
          const chapters = chaptersBySubject[s.id] ?? [];
          return {
            s,
            chapters,
            pct: subjectPct(s.id, state.readSections, state.attempts),
            // Skip chapters with nothing to study: pointing "Continue" at an
            // empty chapter would send a student straight to a dead end.
            next: chapters.find((c) => c.id === state.lastChapterId) ?? chapters.find(hasStudyMaterial),
          };
        }),
    [subjects, chaptersBySubject, derived.subjects, state.readSections, state.attempts, state.lastChapterId]
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return base;
    return base.filter(
      ({ s, chapters }) => s.name.toLowerCase().includes(needle) || chapters.some((c) => c.title.toLowerCase().includes(needle))
    );
  }, [base, q]);

  return (
    <Page>
      <PageHead eyebrow={eyebrow} title={t('study.title')} sub={t('study.subjectsOnList', { n: rows.length })} />

      <Split>
        <Work>
          <div className="field-shell mb-4 flex max-w-[460px] items-center gap-2 rounded-[14px] border-[1.5px] border-line bg-card px-3.5 py-2.5 transition-[border-color,box-shadow] duration-200">
            <Icon name="search" size={18} className="shrink-0 text-ink3" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('study.searchPlaceholder')}
              aria-label={t('study.searchPlaceholder')}
              className="w-full bg-transparent text-[14.5px] text-ink placeholder:text-ink3"
            />
          </div>

          {rows.length === 0 ? (
            <Empty icon="search" title={t('study.noMatchTitle')} sub={t('study.noMatchBody', { q })} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {rows.map(({ s, pct, next, chapters }) => (
                <Link key={s.id} href={`/learn/subject/${s.id}`} className="group min-w-0">
                  <Card className="flex h-full flex-col gap-3 transition-colors duration-200 hover:border-teal">
                    <span className="flex items-center gap-3">
                      <span
                        className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] transition-transform duration-200 group-hover:scale-110"
                        style={{
                          background: SUBJECT_COLORS[s.id]?.tint ?? 'var(--color-tealtint)',
                          color: SUBJECT_COLORS[s.id]?.main ?? 'var(--color-teal)',
                        }}
                      >
                        <Icon name={SUBJECT_ICON[s.id] ?? 'book'} size={22} strokeWidth={2.3} />
                      </span>
                      <span className="min-w-0 flex-1">
                        {state.settings.language === 'ur' && s.urduName ? (
                          <Ur block className="text-[15.5px] text-ink">{s.urduName}</Ur>
                        ) : (
                          <span className="block text-[15.5px] font-extrabold text-ink">{s.name}</span>
                        )}
                        <span className="block text-[12.5px] text-ink2">
                          {t('study.chapterCount', { n: chapters.length })} · {t('study.percentComplete', { n: pct })}
                        </span>
                      </span>
                      <span className="shrink-0 font-display text-[17px] text-teal tabular">{pct}%</span>
                    </span>

                    <Bar pct={pct} tone="teal" h={6} />

                    {next ? (
                      <span className="flex items-center gap-1.5 text-[12.5px] font-extrabold text-teal">
                        <Icon name="arrowRight" size={14} strokeWidth={2.4} className="shrink-0" />
                        <span className="min-w-0 truncate">{t('study.continueChapter', { chapter: next.title })}</span>
                      </span>
                    ) : null}
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </Work>

        <Rail>
          <CoverageRail />
          <WeakRail />
          <UpgradeRail />
        </Rail>
      </Split>
    </Page>
  );
}
