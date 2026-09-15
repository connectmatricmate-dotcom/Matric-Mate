import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { api, chapterById, chapterIsTheirs, chapterName, chaptersFor, inSyllabus } from '@matricmate/core';
import type { Chapter } from '@matricmate/core';
import { useOnline } from '../core/connectivity';
import { localChapter, readableOffline } from '../core/downloads';
import { useAsync } from '../core/useAsync';
import { useLang, useT } from '../i18n';
import { useApp } from '../store/app';
import { C, F, R, S, rowDir } from '../theme';
import { ChapterPicker } from './ChapterPicker';
import { Icon } from './Icon';
import { Btn, Empty, ErrorState, ScriptText, Tap, Text } from './ui';

/**
 * Which chapter a flashcards, blanks or short-questions screen is about when
 * its link names none, and the row that lets the student change it.
 *
 * The Practice tiles and the home "Flashcards" tile open these screens with no
 * chapter. They used to fall back through the last chapter read, then the
 * first chapter of the first subject, then the literal `phy-1`: a new FBISE
 * Class 9 student landed on Matrices, which has nothing in it, and a Class 10
 * or Punjab student on an FBISE Class 9 id their account cannot read. Neither
 * screen said which chapter it was on, and neither offered another.
 */
export type PracticeKind = 'cards' | 'blanks' | 'shortq';

const ROUTE: Record<PracticeKind, string> = {
  cards: '/session/flashcards',
  blanks: '/session/blanks',
  shortq: '/session/shortq',
};

/** Whether a chapter row has this kind of practice. Blanks and short questions come with the notes. */
const offers = (c: Chapter, kind: PracticeKind): boolean => (kind === 'cards' ? c.flashcardCount > 0 : c.sectionCount > 0);

export function usePracticeChapter(param: string | undefined, kind: PracticeKind) {
  const { state, derived, contentKey, contentLoading } = useApp();
  const grade = state.onboarding?.classLevel ?? 9;
  const board = state.onboarding?.board ?? 'fbise';
  const last = state.lastChapterId;

  /*
   * A chapter from the link wins. Without one: where they left off, if that is
   * in their own syllabus and has this kind of practice, else the first chapter
   * of their own subjects that has it. Nothing is composed and nothing is a
   * literal, so the answer is always one of their chapters or none at all, and
   * none means "pick one" rather than a guess.
   */
  const chapterId = useMemo(() => {
    if (param) return param;
    if (last && inSyllabus(last, grade, board)) {
      const known = chapterById(last);
      if (!known || offers(known, kind)) return last;
    }
    for (const sid of derived.subjects) {
      const pick = chaptersFor(sid).find((c) => chapterIsTheirs(c) && offers(c, kind));
      if (pick) return pick.id;
    }
    return undefined;
    // contentKey is not read here and has to be listed: chaptersFor and
    // chapterById read the chapter index, which fills in underneath without
    // React knowing. A tile tapped before it loaded would stay on nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param, last, grade, board, derived.subjects, kind, contentKey]);

  const { data: fetched } = useAsync(
    () => (chapterId ? api.getChapter(chapterId) : Promise.resolve(undefined)),
    [chapterId ?? '', contentKey],
  );
  const chapter: Chapter | undefined =
    fetched ?? (chapterId ? (chapterById(chapterId) ?? localChapter(chapterId) ?? undefined) : undefined);

  /**
   * What an answer here is filed under as its topic: the chapter id, the one
   * rule both apps use (topicKey in core). The chapter's name forked it, Urdu
   * here and English on the website, into two weak topics for one chapter.
   * Weak topics name it in the app's language (topicLabel), never as the id.
   */
  const topic = chapterId ?? '';

  return { chapterId, chapter, topic, waiting: !chapterId && contentLoading };
}

/** Opens the practice screen again on another chapter, starting the set afresh. */
const reopen = (kind: PracticeKind, chapterId: string) => router.replace(`${ROUTE[kind]}?chapter=${chapterId}` as never);

/**
 * The chapter this set is from, and a way to change it. A replace rather than
 * a param change, so the new chapter starts a new set instead of carrying the
 * old one's position and marks.
 */
export function PracticeChapterBar({ kind, chapter }: { kind: PracticeKind; chapter: Chapter | undefined }) {
  const t = useT();
  const { lang } = useLang();
  const [picking, setPicking] = useState(false);
  const name = chapterName(chapter, lang);
  return (
    <>
      <View
        style={{
          flexDirection: rowDir(),
          alignItems: 'center',
          gap: S.sm,
          backgroundColor: C.tealTint,
          borderRadius: R.pill,
          paddingVertical: 7,
          paddingHorizontal: 12,
          marginBottom: S.sm,
        }}
      >
        <Icon name="book" size={15} color={C.teal} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <ScriptText text={name || ' '} face="bodyBold" size={12.5} color={C.teal} lines={1} />
        </View>
        <Tap onPress={() => setPicking(true)} hit>
          <Text style={{ fontFamily: F.bodyBold, fontSize: 12.5, color: C.orangeDark }}>{t('session.changeChapter')}</Text>
        </Tap>
      </View>
      <ChapterPicker
        visible={picking}
        chapterOnly
        onClose={() => setPicking(false)}
        onPick={({ chapter: picked }) => {
          setPicking(false);
          reopen(kind, picked.id);
        }}
      />
    </>
  );
}

/**
 * A set that came back with nothing in it, said for what it is.
 *
 * The content read never throws: offline it answers from the cache, a
 * download or the bundled sample, and on a failed or slow read the same, so
 * an empty answer arrives where an error should. "This chapter does not have
 * this practice type yet" was said offline, and after a dropped read, about
 * chapters that have plenty (every live chapter has all three kinds). Offline
 * on a chapter not on the phone, it says so; a chapter whose own row counts
 * this kind of practice is a read that failed, with a retry; only a chapter
 * that really has none is empty.
 */
export function PracticeEmpty({
  kind,
  chapterId,
  chapter,
  onRetry,
}: {
  kind: PracticeKind;
  chapterId: string | undefined;
  chapter: Chapter | undefined;
  onRetry: () => void;
}) {
  const t = useT();
  const online = useOnline();
  const { state } = useApp();
  if (!online && chapterId && !readableOffline(chapterId, state.settings.contentMedium)) {
    return <ErrorState title={t('offline.title')} sub={t('session.offlineChapterBody')} retry={t('common.retry')} onRetry={onRetry} />;
  }
  // A live row (it has a board) that counts this practice: the read failed.
  if (chapter && chapter.board !== undefined && offers(chapter, kind)) {
    return <ErrorState title={t('states.errorTitle')} sub={t('states.errorBody')} retry={t('common.retry')} onRetry={onRetry} />;
  }
  return <Empty title={t('session.noItemsTitle')} sub={t('session.noItemsBody')} />;
}

/** Nothing to start from: none of their chapters has this kind of practice yet, or the index is not in. */
export function PickPracticeChapter({ kind }: { kind: PracticeKind }) {
  const t = useT();
  const [picking, setPicking] = useState(false);
  return (
    <>
      <Empty
        emoji="📚"
        title={t('session.pickChapter')}
        sub={t('session.pickChapterBody')}
        cta={<Btn title={t('session.pickChapter')} sm onPress={() => setPicking(true)} />}
      />
      <ChapterPicker
        visible={picking}
        chapterOnly
        onClose={() => setPicking(false)}
        onPick={({ chapter }) => {
          setPicking(false);
          reopen(kind, chapter.id);
        }}
      />
    </>
  );
}
