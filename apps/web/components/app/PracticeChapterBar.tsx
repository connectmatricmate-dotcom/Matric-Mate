'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { chapterName, type Chapter } from '@matricmate/core';
import { Icon, ScriptText } from '@/components/ui/primitives';
import { ChapterPicker } from '@/components/ui/ChapterPicker';
import { useApp, useT } from '@/lib/store';

export type PracticeKind = 'cards' | 'blanks' | 'shortq';
const ROUTE: Record<PracticeKind, string> = { cards: '/session/flashcards', blanks: '/session/blanks', shortq: '/session/shortq' };

/**
 * The chapter a practice set is drawn from, and a way to change it.
 *
 * From Practice, flashcards, blanks and short questions opened on whichever
 * chapter the student last used, and on the website there was no way to pick
 * another: the Android app has had this bar all along. A replace rather than a
 * push, so the new chapter starts a fresh set and back still goes to wherever
 * the set was opened.
 */
export function PracticeChapterBar({ kind, chapter }: { kind: PracticeKind; chapter: Chapter }) {
  const router = useRouter();
  const t = useT();
  const { state } = useApp();
  const [picking, setPicking] = useState(false);
  return (
    <>
      <div className="mb-3 flex items-center gap-2 rounded-full bg-tealtint px-3 py-1.5">
        <Icon name="book" size={15} className="shrink-0 text-teal" />
        <ScriptText
          text={chapterName(chapter, state.settings.language)}
          className="min-w-0 flex-1 truncate text-[12.5px] font-extrabold text-teal"
          urduClassName="min-w-0 flex-1 truncate text-[12.5px] text-teal"
        />
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="-my-1.5 inline-flex min-h-11 shrink-0 items-center px-1 text-[12.5px] font-extrabold text-orangedark transition-colors duration-200 hover:brightness-90"
        >
          {t('session.changeChapter')}
        </button>
      </div>
      <ChapterPicker
        open={picking}
        chapterOnly
        onClose={() => setPicking(false)}
        onPick={({ chapter: picked }) => {
          setPicking(false);
          router.replace(`${ROUTE[kind]}?chapter=${picked.id}`);
        }}
      />
    </>
  );
}
