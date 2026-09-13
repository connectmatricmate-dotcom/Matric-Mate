'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { type Chapter, api, chapterName, subjectById, subjectName } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Btn, ItemButton, Seg } from '@/components/ui/controls';
import { Card, Check, Item, SectionTitle, Skeleton } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { useApp, useLang, useT } from '@/lib/store';
import { session } from '@/lib/session';

export function SessionSetupSkeleton() {
  return (
    <Page width="focus">
      <div className="mb-5">
        {/* The back link is a 44px row, not a 14px line. */}
        <div className="mb-1 flex h-11 items-center">
          <Skeleton className="h-3.5 w-24" />
        </div>
        <Skeleton className="mb-2 h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      <Skeleton className="mb-2 h-3 w-16" />
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-11 w-20 rounded-full" />
        ))}
      </div>

      <Skeleton className="mt-6 mb-2 h-3 w-20" />
      <Card flat className="py-0">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`flex items-center gap-3 py-3.5 ${i < 3 ? 'border-b border-line' : ''}`}>
            <Skeleton className="h-10 w-10 shrink-0 rounded-[13px]" />
            <div className="flex-1">
              <Skeleton className="mb-1.5 h-3.5 w-2/5" />
              <Skeleton className="h-2.5 w-1/4" />
            </div>
          </div>
        ))}
      </Card>

      <Skeleton className="mt-6 mb-2 h-3 w-24" />
      <Skeleton className="h-10 w-full max-w-[280px] rounded-full" />

      <Skeleton className="mt-6 h-11 w-full max-w-[220px] rounded-full" />
    </Page>
  );
}

export function SessionSetup({
  initialChapterId,
  chaptersBySubject,
}: {
  initialChapterId?: string;
  chaptersBySubject: Record<string, Chapter[]>;
}) {
  const router = useRouter();
  const { derived } = useApp();
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();

  /* Found in the server's own lists, not the browser's chapter index, which is
     empty on a cold load for Class 10 and Punjab: a "Practice MCQs" tap from
     their chapter hub opened on mixed practice with nothing ticked. */
  const initialChapter = initialChapterId
    ? chaptersBySubject[initialChapterId.split('-')[0]]?.find((c) => c.id === initialChapterId)
    : undefined;
  const [subjectId, setSubjectId] = useState(initialChapter?.subjectId ?? derived.subjects[0] ?? 'phy');
  const [chapterIds, setChapterIds] = useState<string[]>(initialChapter ? [initialChapter.id] : []);
  const [count, setCount] = useState<'10' | '20' | '50'>('10');
  const [busy, setBusy] = useState(false);
  const [pickedSubject, setPickedSubject] = useState(subjectId);

  /* Every chapter. This hid premium chapters until the plan had been re-read
     in the browser, and every chapter is premium, so a paying student met an
     empty list on every cold load. The layout has already refused anyone
     without a plan. */
  const chapters = useMemo(() => chaptersBySubject[subjectId] ?? [], [chaptersBySubject, subjectId]);

  // The default subject is picked before the store hydrates, when the subject
  // list is still the fallback. Adjusted during render when the real list
  // arrives: if the current pick isn't a subject the student studies, move to
  // their first one. A pick they made from the chips is always in the list.
  const [seenSubjects, setSeenSubjects] = useState(derived.subjects);
  if (seenSubjects !== derived.subjects) {
    setSeenSubjects(derived.subjects);
    if (!initialChapter && derived.subjects.length && !derived.subjects.includes(subjectId)) {
      setSubjectId(derived.subjects[0]);
    }
  }

  // Chapter picks belong to the subject they were made in. Cleared during
  // render so the list below never shows a tick against another subject.
  if (subjectId !== pickedSubject) {
    setPickedSubject(subjectId);
    setChapterIds([]);
  }

  async function start() {
    setBusy(true);
    const mcqs = await api.getMcqs({
      chapterIds: chapterIds.length ? chapterIds : undefined,
      subjectId: chapterIds.length ? undefined : subjectId,
      count: Number(count),
    });
    if (!mcqs.length) {
      setBusy(false);
      toast(t('session.noQuestions'));
      return;
    }
    // The label a student sees on the session header: one chapter's own name,
    // in their language, or the subject and "mixed" when it spans several.
    const single = chapterIds.length === 1 ? chapters.find((c) => c.id === chapterIds[0]) : undefined;
    // busy stays true through router.replace: re-enabling the button while the
    // route transition runs is the double-click window.
    session.start({
      mode: 'practice',
      label: single ? chapterName(single, lang) : `${subjectName(subjectById(subjectId), lang)} · ${t('session.mixed')}`,
      subjectId,
      chapterId: chapterIds.length === 1 ? chapterIds[0] : null,
      mcqs,
    });
    router.replace('/session/mcq');
  }

  return (
    <Page width="focus">
      <PageHead
        back="/practice"
        backLabel={t('practice.title')}
        title={t('session.setupTitle')}
        sub={initialChapter ? subjectName(subjectById(initialChapter.subjectId), lang) || t('session.setupSub') : t('session.setupSub')}
      />

      {/*
       * Opened from a chapter, the set is that chapter's and nothing else. The
       * screen used to arrive with the chapter ticked but still offer every
       * subject, "Mixed, all chapters" and the whole list, asking a student
       * who had just picked a chapter to pick again. The pickers stay for the
       * Practice page, where nothing has been chosen yet.
       */}
      {initialChapter ? (
        <>
          <SectionTitle>{t('session.chapter')}</SectionTitle>
          <Card flat className="py-0">
            <Item
              title={chapterName(initialChapter, lang)}
              sub={initialChapter.mcqCount ? t('study.mcqsSub', { n: initialChapter.mcqCount }) : undefined}
              icon="book"
              tone="teal"
              last
            />
          </Card>
        </>
      ) : (
        <>
          <SectionTitle>{t('session.subject')}</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {derived.subjects.map((sid) => (
              <button
                key={sid}
                type="button"
                aria-pressed={sid === subjectId}
                onClick={() => setSubjectId(sid)}
                className={`min-h-11 rounded-full px-3.5 py-2 text-[13px] font-extrabold transition-[background-color,filter] duration-200 ${
                  sid === subjectId ? 'bg-tealtint text-teal' : 'bg-grey text-ink2 hover:brightness-95'
                }`}
              >
                {subjectName(subjectById(sid), lang) || sid}
              </button>
            ))}
          </div>

          <SectionTitle
            action={
              <span className="text-[13px] text-ink2">
                {chapterIds.length ? t('session.selected', { n: chapterIds.length }) : t('session.allChapters')}
              </span>
            }
          >
            {t('session.chapters')}
          </SectionTitle>
          <Card flat className="py-0">
            <ItemButton
              title={t('session.mixed')}
              sub={t('session.mixedSub')}
              icon="cards"
              tone={chapterIds.length === 0 ? 'teal' : 'grey'}
              onClick={() => setChapterIds([])}
              right={<Check on={chapterIds.length === 0} round />}
            />
            {chapters.map((c, i) => {
              const on = chapterIds.includes(c.id);
              return (
                <ItemButton
                  key={c.id}
                  title={chapterName(c, lang)}
                  sub={t('study.mcqsSub', { n: c.mcqCount })}
                  icon="book"
                  tone={on ? 'teal' : 'grey'}
                  last={i === chapters.length - 1}
                  onClick={() => setChapterIds((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))}
                  right={<Check on={on} />}
                />
              );
            })}
            {chapters.length === 0 ? <Item title={t('session.noQuestions')} last /> : null}
          </Card>
        </>
      )}

      <SectionTitle>{t('session.howMany')}</SectionTitle>
      <Seg
        value={count}
        onChange={setCount}
        label={t('session.howMany')}
        options={[
          { value: '10' as const, label: '10' },
          { value: '20' as const, label: '20' },
          { value: '50' as const, label: '50' },
        ]}
      />

      <div className="mt-6">
        <Btn title={t('session.start', { n: count })} onClick={start} loading={busy} className="w-full md:w-auto" />
      </div>
    </Page>
  );
}
