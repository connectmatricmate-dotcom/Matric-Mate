import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import {
  api,
  chapterChoices,
  chapterName,
  fetchChapterTopics,
  isUrduScript,
  matchChapters,
  subjectById,
  subjectName,
  type ChapterChoice,
} from '@matricmate/core';
import { supabase } from '../lib/supabase';
import { useLang, useT } from '../i18n';
import { useApp } from '../store/app';
import { C, F, R, S, isWeb, rowDir, textStart, urdu } from '../theme';
import { Icon } from './Icon';
import { Sheet, Small, Tap, Text, TextInput } from './ui';

/**
 * Choosing what the tutor should answer from: subject, then chapter, then the
 * topic inside it.
 *
 * The tutor tab has always said "From your own chapters" and never meant it.
 * Tapping the tile sent a hardcoded question about Newton's second law and
 * spent one of the student's fifty for the day. This is the part that makes
 * the promise true: the server already reads a chapter's published notes when
 * a question carries a chapter id (chapterGrounding, in the tutor route), and
 * nothing on the phone passed one except the Ask AI buttons inside a chapter.
 *
 * Three levels, because that is how the syllabus is actually shaped and how a
 * student thinks about it: nine subjects, up to thirteen chapters each, and
 * the sections inside a chapter. Drilling down is the reliable path. Typing is
 * the fast one, and the search box cuts across all three at once, so somebody
 * who knows the word "momentum" never sees the subject list at all.
 *
 * Choosing a chapter and stopping there is a valid answer, which is why the
 * topic level leads with the whole chapter rather than forcing a third tap.
 */

export type ChapterPick = { chapter: ChapterChoice; topic?: string };

type Level = { kind: 'subjects' } | { kind: 'chapters'; subjectId: string } | { kind: 'topics'; chapter: ChapterChoice };

export function ChapterPicker(props: {
  visible: boolean;
  onClose: () => void;
  onPick: (pick: ChapterPick) => void;
  /**
   * Stop at the chapter. The practice screens want a chapter and nothing
   * inside it, so a third tap on "The whole chapter" would be a tap for
   * nothing.
   */
  chapterOnly?: boolean;
}) {
  const t = useT();
  /* Mounted only while open, which is what resets it: somebody who backed out
     of Chemistry last time is not usually coming back to Chemistry. */
  if (!props.visible) return null;
  /* One stable title on the sheet; where you are in the tree is the
     breadcrumb inside it. The list below brings its own scroller, so the
     search box stays put above it rather than scrolling away. */
  return (
    <Sheet visible onClose={props.onClose} title={t('tutor.pickChapterTitle')} scroll={false}>
      <Picking onPick={props.onPick} chapterOnly={props.chapterOnly} />
    </Sheet>
  );
}

function Picking({ onPick, chapterOnly }: { onPick: (pick: ChapterPick) => void; chapterOnly?: boolean }) {
  const { derived, contentKey, contentLoading } = useApp();
  const t = useT();
  const { lang } = useLang();
  const [level, setLevel] = useState<Level>({ kind: 'subjects' });
  const [query, setQuery] = useState('');
  /** Keyed by chapter, so "still loading" is a comparison rather than a
   *  synchronous setState the moment the level changes. */
  const [topics, setTopics] = useState<{ forChapter: string; list: string[] } | null>(null);

  // contentKey is not read here and has to be listed: chapterChoices reads the
  // chapter index, which fills in (or changes syllabus) underneath without
  // React knowing, and a picker opened a second early used to stay on "0".
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const choices = useMemo(() => chapterChoices(derived.subjects), [derived.subjects, contentKey]);

  /**
   * A subject the index has nothing for yet is read when it is opened.
   *
   * The lists above come from the synchronous index, and a Class 10 or Punjab
   * student who opened this before it had loaded saw "0 chapters" on every
   * subject and an empty list under each. Keyed by subject and syllabus, so a
   * list read before a switch is never shown after it.
   */
  const [fetched, setFetched] = useState<Record<string, ChapterChoice[]>>({});
  const opened = level.kind === 'chapters' ? level.subjectId : null;
  const fetchKey = opened ? `${contentKey}|${opened}` : null;
  const haveOpened = opened ? choices.some((c) => c.subjectId === opened) : true;
  useEffect(() => {
    if (!opened || !fetchKey || haveOpened) return;
    let alive = true;
    const subject = subjectById(opened);
    api.getChapters(opened).then(
      (rows) => {
        if (!alive) return;
        setFetched((f) => ({
          ...f,
          [fetchKey]: rows.map((c) => ({
            id: c.id,
            title: c.title,
            urduTitle: c.urduTitle,
            subjectId: opened,
            subjectName: subject?.name ?? opened,
            subjectUrduName: subject?.urduName,
            number: c.number,
          })),
        }));
      },
      // A failed read settles as an empty list, so the spinner gives way to
      // the "no chapters" line instead of turning forever.
      () => {
        if (alive) setFetched((f) => ({ ...f, [fetchKey]: [] }));
      },
    );
    return () => {
      alive = false;
    };
  }, [opened, fetchKey, haveOpened]);

  const listFor = (sid: string): ChapterChoice[] => {
    const own = choices.filter((c) => c.subjectId === sid);
    return own.length ? own : (fetched[`${contentKey}|${sid}`] ?? []);
  };
  /** Nothing to show yet, and something is still on its way. */
  const stillLoading = (sid: string): boolean =>
    listFor(sid).length === 0 && (contentLoading || (opened === sid && !fetched[`${contentKey}|${sid}`]));
  const pickChapter = (c: ChapterChoice) => (chapterOnly ? onPick({ chapter: c }) : setLevel({ kind: 'topics', chapter: c }));

  /* Section headings are the only part of this that needs the network, so
     they are fetched when the third level is actually opened, not before. */
  useEffect(() => {
    if (level.kind !== 'topics') return;
    const forChapter = level.chapter.id;
    let alive = true;
    fetchChapterTopics(forChapter, supabase ?? undefined).then((list: string[]) => {
      if (alive) setTopics({ forChapter, list });
    });
    return () => {
      alive = false;
    };
  }, [level]);

  const searching = query.trim().length > 0;
  const hits = useMemo(() => (searching ? matchChapters(choices, query, 40) : []), [choices, query, searching]);

  const back = () => {
    if (level.kind === 'topics') setLevel({ kind: 'chapters', subjectId: level.chapter.subjectId });
    else setLevel({ kind: 'subjects' });
  };

  return (
    <>
      {/* One step back up the tree, never off the sheet. Hidden while
          searching, because search is not a level and there is nothing above
          it to return to. */}
      {level.kind !== 'subjects' && !searching ? (
        <Tap onPress={back}>
          <View style={{ flexDirection: rowDir(), alignItems: 'center', gap: 6, paddingBottom: S.sm }}>
            <Icon name="back" size={16} color={C.teal} />
            <Small style={{ fontFamily: F.bodyBold, color: C.teal }}>
              {level.kind === 'topics'
                ? subjectName(subjectById(level.chapter.subjectId), lang)
                : t('tutor.pickSubjectTitle')}
            </Small>
          </View>
        </Tap>
      ) : null}

      <View
        style={{
          flexDirection: rowDir(),
          alignItems: 'center',
          gap: S.sm,
          backgroundColor: C.paper,
          borderWidth: 1.5,
          borderColor: C.line,
          borderRadius: R.pill,
          paddingHorizontal: 14,
          paddingVertical: 10,
          marginBottom: S.sm,
        }}
      >
        <Icon name="search" size={17} color={C.ink3} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('tutor.pickSearchHint')}
          placeholderTextColor={C.ink3}
          style={[
            { flex: 1, fontFamily: F.body, fontSize: 14, color: C.ink, paddingVertical: 0, textAlign: textStart() },
            isUrduScript(query) ? { ...urdu(14), paddingVertical: 0 } : null,
            isWeb && ({ outlineStyle: 'none' } as object),
          ]}
        />
        {query ? (
          <Tap onPress={() => setQuery('')} hit label={t('a11y.clearSearch')}>
            <Icon name="close" size={16} color={C.ink3} />
          </Tap>
        ) : null}
      </View>

      {/* Takes whatever height the sheet has left and scrolls within it, so a
          subject with thirteen chapters cannot push the search box off the
          screen. It used to be a fixed 330, inside a sheet with its own cap:
          in Urdu on a short phone the two did not fit together and the last
          rows could never be scrolled into view, and with the keyboard up the
          list sat behind it. */}
      <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} keyboardShouldPersistTaps="handled">
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
                onPress={() => pickChapter(c)}
              />
            ))
          )
        ) : level.kind === 'subjects' ? (
          derived.subjects.map((sid, i) => {
            const subject = subjectById(sid);
            const count = choices.filter((c) => c.subjectId === sid).length;
            // A subject the index has not answered for yet is not a subject
            // with no chapters: it says so rather than "0 chapters".
            const waiting = count === 0 && contentLoading;
            return (
              <RowItem
                key={sid}
                badge={waiting ? '…' : String(count)}
                title={subjectName(subject, lang) || sid}
                sub={waiting ? t('common.loading') : count ? t('tutor.chapterCount', { n: count }) : undefined}
                last={i === derived.subjects.length - 1}
                onPress={() => setLevel({ kind: 'chapters', subjectId: sid })}
              />
            );
          })
        ) : level.kind === 'chapters' ? (
          listFor(level.subjectId).length === 0 ? (
            stillLoading(level.subjectId) ? (
              <View style={{ paddingVertical: S.lg, alignItems: 'center' }}>
                <ActivityIndicator color={C.teal} />
              </View>
            ) : (
              <Blank text={t('tutor.noChapters')} />
            )
          ) : (
            listFor(level.subjectId).map((c, i, all) => (
              <RowItem
                key={c.id}
                badge={String(c.number)}
                title={chapterName(c, lang)}
                last={i === all.length - 1}
                onPress={() => pickChapter(c)}
              />
            ))
          )
        ) : (
          <>
            {/* Stopping at the chapter is a real answer, so it leads. */}
            <RowItem
              badge="★"
              title={t('tutor.wholeChapter')}
              sub={chapterName(level.chapter, lang)}
              last={false}
              onPress={() => onPick({ chapter: level.chapter })}
            />
            {topics?.forChapter !== level.chapter.id ? (
              <View style={{ paddingVertical: S.lg, alignItems: 'center' }}>
                <ActivityIndicator color={C.teal} />
              </View>
            ) : topics.list.length === 0 ? (
              <Blank text={t('tutor.noTopics')} />
            ) : (
              topics.list.map((topic, i) => (
                <RowItem
                  key={`${topic}-${i}`}
                  badge={String(i + 1)}
                  title={topic}
                  last={i === topics.list.length - 1}
                  onPress={() => onPick({ chapter: level.chapter, topic })}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}

function Blank({ text }: { text: string }) {
  return <Small style={{ paddingVertical: S.lg, textAlign: 'center' }}>{text}</Small>;
}

function RowItem({
  badge,
  title,
  sub,
  last,
  onPress,
}: {
  badge: string;
  title: string;
  sub?: string;
  last: boolean;
  onPress: () => void;
}) {
  return (
    <Tap onPress={onPress}>
      <View
        style={{
          flexDirection: rowDir(),
          alignItems: 'center',
          gap: S.sm,
          // 48, comfortably past the 44 minimum, because this list is scrolled
          // with a thumb and the rows are near-identical to each other.
          minHeight: 48,
          paddingVertical: 10,
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: C.line,
        }}
      >
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            backgroundColor: C.tealTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: F.bodyBold, fontSize: 12, color: C.teal }}>{badge}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          {isUrduScript(title) ? (
            <Text numberOfLines={2} style={{ ...urdu(14), color: C.ink }}>
              {title}
            </Text>
          ) : (
            <Text numberOfLines={2} style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.ink }}>
              {title}
            </Text>
          )}
          {sub ? (
            isUrduScript(sub) ? (
              <Text numberOfLines={1} style={{ ...urdu(11.5), color: C.ink2 }}>
                {sub}
              </Text>
            ) : (
              <Small numberOfLines={1} style={{ fontSize: 11.5 }}>
                {sub}
              </Small>
            )
          ) : null}
        </View>
        <Icon name="chevron" size={16} color={C.ink3} />
      </View>
    </Tap>
  );
}
