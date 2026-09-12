'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  chapterChoices,
  chapterName,
  fetchChapterTopics,
  matchChapters,
  subjectById,
  subjectName,
  type ChapterChoice,
} from '@matricmate/core';
import { Icon, ScriptText } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { createClient } from '@/lib/supabase/client';
import { useApp, useLang, useT } from '@/lib/store';

/**
 * Choosing what the tutor should answer from: subject, then chapter, then the
 * topic inside it. The Android app has the same thing, deliberately
 * (src/components/ChapterPicker.tsx there).
 *
 * The tutor page has always said "From your own chapters" and never meant it:
 * the tile sent a hardcoded question about Newton's second law and spent one
 * of the student's fifty for the day. This is what makes the promise true. The
 * server already reads a chapter's published notes when a question carries a
 * chapter id (chapterGrounding, in the tutor route).
 *
 * Drilling down is the reliable path; the search box is the fast one and cuts
 * across all three levels at once, so somebody who knows the word "momentum"
 * never sees the subject list.
 */

export type ChapterPick = { chapter: ChapterChoice; topic?: string };

type Level = { kind: 'subjects' } | { kind: 'chapters'; subjectId: string } | { kind: 'topics'; chapter: ChapterChoice };

export function ChapterPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (pick: ChapterPick) => void;
}) {
  const t = useT();
  // Mounted only while open, which is what resets it: somebody who backed out
  // of Chemistry last time is not usually coming back to Chemistry.
  if (!open) return null;
  /* The dialog keeps one stable title, which is what a screen reader
     announces on open; where you are in the tree is the breadcrumb inside. A
     title that changed under you on every tap would be announced as a new
     dialog each time. */
  return (
    <Sheet open onClose={onClose} title={t('tutor.pickChapterTitle')}>
      <Picking onPick={onPick} />
    </Sheet>
  );
}

function Picking({ onPick }: { onPick: (pick: ChapterPick) => void }) {
  const { derived } = useApp();
  const t = useT();
  const { lang } = useLang();
  const [level, setLevel] = useState<Level>({ kind: 'subjects' });
  const [query, setQuery] = useState('');
  /** Keyed by chapter, so "still loading" is a comparison rather than a
   *  synchronous setState the moment the level changes. */
  const [topics, setTopics] = useState<{ forChapter: string; list: string[] } | null>(null);

  const choices = useMemo(() => chapterChoices(derived.subjects), [derived.subjects]);

  useEffect(() => {
    if (level.kind !== 'topics') return;
    const forChapter = level.chapter.id;
    let alive = true;
    fetchChapterTopics(forChapter, createClient())
      .then((list: string[]) => {
        if (alive) setTopics({ forChapter, list });
      })
      // A failed read still settles, as an empty list, so the student gets
      // "no topics" and the whole-chapter row rather than a skeleton that
      // pulses forever.
      .catch(() => {
        if (alive) setTopics({ forChapter, list: [] });
      });
    return () => {
      alive = false;
    };
  }, [level]);

  const searching = query.trim().length > 0;
  const hits = useMemo(() => (searching ? matchChapters(choices, query, 40) : []), [choices, query, searching]);

  const back = () =>
    level.kind === 'topics'
      ? setLevel({ kind: 'chapters', subjectId: level.chapter.subjectId })
      : setLevel({ kind: 'subjects' });

  return (
    <div className="flex flex-col gap-3">
      {/* One step back up the tree, never off the dialog. Hidden while
          searching: search is not a level and has nothing above it. */}
      {level.kind !== 'subjects' && !searching ? (
        <button
          type="button"
          onClick={back}
          className="-ms-1 inline-flex min-h-11 items-center gap-1 self-start text-[13px] font-extrabold text-teal transition-colors duration-200 hover:brightness-90"
        >
          <Icon name="chevron" size={16} className="rotate-180" />
          {level.kind === 'topics'
            ? subjectName(subjectById(level.chapter.subjectId), lang)
            : t('tutor.pickSubjectTitle')}
        </button>
      ) : null}

      {/* field-shell gives it the same focus ring as every other field; the
          input inside stays bare. */}
      <label className="field-shell flex items-center gap-2 rounded-full border-[1.5px] border-line bg-paper px-4 py-2.5 transition-[border-color,box-shadow] duration-200">
        <Icon name="search" size={17} className="shrink-0 text-ink3" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('tutor.pickSearchHint')}
          aria-label={t('tutor.pickSearchHint')}
          // 16px on phones, or iOS Safari zooms the page into the field.
          className="min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink3 md:text-[14px]"
        />
        {query ? (
          // 40px target, tucked into the pill's padding so the pill keeps
          // its height when the button appears.
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={t('common.cancel')}
            className="-my-2.5 -me-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink3 transition-colors duration-200 hover:bg-card hover:text-ink"
          >
            <Icon name="close" size={16} />
          </button>
        ) : null}
      </label>

      {/* Bounded, so thirteen chapters cannot push the search box off the
          dialog: the list scrolls under it instead. */}
      <div className="max-h-[340px] overflow-y-auto">
        {searching ? (
          hits.length === 0 ? (
            <Blank text={t('tutor.mentionNone')} />
          ) : (
            hits.map((c, i) => (
              <RowItem
                key={c.id}
                badge={String(c.number)}
                title={chapterName(c, lang)}
                sub={lang === 'ur' ? (c.subjectUrduName ?? c.subjectName) : c.subjectName}
                last={i === hits.length - 1}
                onClick={() => setLevel({ kind: 'topics', chapter: c })}
              />
            ))
          )
        ) : level.kind === 'subjects' ? (
          derived.subjects.map((sid, i) => {
            const count = choices.filter((c) => c.subjectId === sid).length;
            return (
              <RowItem
                key={sid}
                badge={String(count)}
                title={subjectName(subjectById(sid), lang) || sid}
                sub={t('tutor.chapterCount', { n: count })}
                last={i === derived.subjects.length - 1}
                onClick={() => setLevel({ kind: 'chapters', subjectId: sid })}
              />
            );
          })
        ) : level.kind === 'chapters' ? (
          choices
            .filter((c) => c.subjectId === level.subjectId)
            .map((c, i, all) => (
              <RowItem
                key={c.id}
                badge={String(c.number)}
                title={chapterName(c, lang)}
                last={i === all.length - 1}
                onClick={() => setLevel({ kind: 'topics', chapter: c })}
              />
            ))
        ) : (
          <>
            {/* Stopping at the chapter is a real answer, so it leads. */}
            <RowItem
              badge="★"
              title={t('tutor.wholeChapter')}
              sub={chapterName(level.chapter, lang)}
              last={false}
              onClick={() => onPick({ chapter: level.chapter })}
            />
            {topics?.forChapter !== level.chapter.id ? (
              <div className="space-y-2 py-3">
                <div className="h-11 w-full animate-pulse rounded-[12px] bg-inkghost" />
                <div className="h-11 w-full animate-pulse rounded-[12px] bg-inkghost" />
              </div>
            ) : topics.list.length === 0 ? (
              <Blank text={t('tutor.noTopics')} />
            ) : (
              topics.list.map((topic, i) => (
                <RowItem
                  key={`${topic}-${i}`}
                  badge={String(i + 1)}
                  title={topic}
                  last={i === topics.list.length - 1}
                  onClick={() => onPick({ chapter: level.chapter, topic })}
                />
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Blank({ text }: { text: string }) {
  return <p className="py-6 text-center text-[13px] text-ink2">{text}</p>;
}

function RowItem({
  badge,
  title,
  sub,
  last,
  onClick,
}: {
  badge: string;
  title: string;
  sub?: string;
  last: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full min-h-12 items-center gap-3 py-2.5 text-start transition-colors duration-200 hover:bg-paper ${
        last ? '' : 'border-b border-line'
      }`}
    >
      <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-tealtint text-[12px] font-extrabold text-teal">
        {badge}
      </span>
      {/* Chapter and subject names arrive in Urdu for an Urdu student, and
          they need the Nastaliq face and its line height, not the Latin one. */}
      <span className="min-w-0 flex-1">
        <ScriptText text={title} className="truncate text-[14px] font-extrabold text-ink" urduClassName="min-w-0 truncate text-[14px] text-ink" />
        {sub ? (
          <ScriptText text={sub} className="truncate text-[11.5px] text-ink2" urduClassName="min-w-0 truncate text-[11.5px] text-ink2" />
        ) : null}
      </span>
      <Icon name="chevron" size={16} className="shrink-0 text-ink3" />
    </button>
  );
}
