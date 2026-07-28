'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { CHAPTERS, api, chapterById, subjectById } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Btn, ItemButton, Seg } from '@/components/ui/controls';
import { Card, Check, Item, SectionTitle } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { useApp, useT } from '@/lib/store';
import { session } from '@/lib/session';

export function SessionSetup({ initialChapterId }: { initialChapterId?: string }) {
  const router = useRouter();
  const { derived, state } = useApp();
  const t = useT();
  const toast = useToast();

  const initialChapter = initialChapterId ? chapterById(initialChapterId) : undefined;
  const [subjectId, setSubjectId] = useState(initialChapter?.subjectId ?? derived.subjects[0] ?? 'phy');
  const [chapterIds, setChapterIds] = useState<string[]>(initialChapter ? [initialChapter.id] : []);
  const [count, setCount] = useState<'10' | '20' | '50'>('10');
  const [busy, setBusy] = useState(false);
  const [pickedSubject, setPickedSubject] = useState(subjectId);

  const chapters = useMemo(
    () => (CHAPTERS[subjectId] ?? []).filter((c) => !c.premium || state.premium.active),
    [subjectId, state.premium.active]
  );

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
    setBusy(false);
    if (!mcqs.length) {
      toast(t('session.noQuestions'));
      return;
    }
    session.start({
      mode: 'practice',
      label:
        chapterIds.length === 1
          ? (chapterById(chapterIds[0])?.title ?? '')
          : `${subjectById(subjectId)?.name} · ${t('session.mixed')}`,
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
        sub={t('session.setupSub')}
      />

      <SectionTitle>{t('session.subject')}</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {derived.subjects.map((sid) => (
          <button
            key={sid}
            type="button"
            aria-pressed={sid === subjectId}
            onClick={() => setSubjectId(sid)}
            className={`min-h-10 rounded-full px-3.5 py-2 text-[13px] font-extrabold transition-colors duration-200 ${
              sid === subjectId ? 'bg-tealtint text-teal' : 'bg-grey text-ink2 hover:brightness-95'
            }`}
          >
            {subjectById(sid)?.name ?? sid}
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
              title={c.title}
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

      <p className="mt-4 text-[13px] text-ink2">
        {state.premium.active ? t('session.premiumActive') : t('session.premiumNote')}
      </p>

      <div className="sticky bottom-0 mt-5 bg-paper/95 py-4 backdrop-blur">
        <Btn title={t('session.start', { n: count })} onClick={start} loading={busy} className="w-full md:w-auto" />
      </div>
    </Page>
  );
}
