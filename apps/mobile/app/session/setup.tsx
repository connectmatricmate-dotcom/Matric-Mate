import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Btn, Card, Check, Header, Item, Pill, Screen, SectionTitle, Seg, Skeleton, Small, useToast } from '../../src/components/ui';
import { api, chapterById, chapterName, subjectById, subjectName } from '@matricmate/core';
import { useOnline } from '../../src/core/connectivity';
import { useAsync } from '../../src/core/useAsync';
import { useLang, useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { session } from '../../src/store/session';
import { C, S, rowDir } from '../../src/theme';

export default function SessionSetup() {
  const { chapter: chapterParam } = useLocalSearchParams<{ chapter?: string }>();
  const { derived, state, contentKey } = useApp();
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const online = useOnline();

  /*
   * A chapter from the link is kept even when the index cannot name it yet:
   * its id carries its subject. It used to be dropped whenever the lookup
   * missed (a cold start, offline on Class 10 or Punjab), and the session
   * quietly became mixed Mathematics. Without a chapter, the subject today's
   * plan is on, rather than Mathematics for everyone.
   */
  const [subjectId, setSubjectId] = useState(
    (chapterParam ? (chapterById(chapterParam)?.subjectId ?? chapterParam.split('-')[0]) : undefined) ??
      derived.plan[0]?.subjectId ??
      derived.subjects[0] ??
      'phy',
  );
  const [chapterIds, setChapterIds] = useState<string[]>(chapterParam ? [chapterParam] : []);
  const [count, setCount] = useState<'10' | '20' | '50'>('10');
  const [busy, setBusy] = useState(false);

  // contentKey: a language, class or board switch reaches an open setup.
  const { data: chapterList, loading: chaptersLoading } = useAsync(() => api.getChapters(subjectId), [subjectId, contentKey]);
  const chapters = useMemo(
    () =>
      (chapterList ?? []).filter(
        (c) =>
          (!c.premium || state.premium.active) &&
          // A chapter the database says has no questions is not offered: it
          // could only end in "No questions". A row with no board is the
          // bundle, whose zeroes mean "not known", so it stays.
          !(c.board !== undefined && c.mcqCount === 0),
      ),
    [chapterList, state.premium.active]
  );

  /**
   * Switching subject clears the chapter ticks, because a chapter from Physics
   * means nothing once the student has moved to Chemistry.
   *
   * Adjusted during render by comparing against the previous subject, which is
   * the pattern React documents for this. As an effect it ran a beat late: the
   * list rendered once showing the new subject's chapters with the old
   * subject's ticks still on, and only then cleared them.
   */
  const [lastSubject, setLastSubject] = useState(subjectId);
  if (lastSubject !== subjectId) {
    setLastSubject(subjectId);
    // Always. The old guard kept the deep-linked chapter ticked across a
    // subject switch, so a "Chemistry" session could quietly fetch the
    // Physics chapter it arrived with.
    setChapterIds([]);
  }

  /*
   * Opened from a chapter, the set is that chapter's and nothing else.
   *
   * The screen used to arrive with the chapter ticked but still show every
   * subject, "Mixed, all chapters" and the whole chapter list, which asked a
   * student who had just picked a chapter to pick again. The client's words:
   * we already chose the chapter, only that chapter should be there. The
   * pickers stay for the Practice tab and the home screen's quick action,
   * where nothing has been chosen yet.
   */
  const fixed = chapterParam
    ? (chapters.find((c) => c.id === chapterParam) ?? chapterById(chapterParam) ?? null)
    : null;

  async function start() {
    setBusy(true);
    let mcqs;
    try {
      mcqs = await api.getMcqs({
        chapterIds: chapterIds.length ? chapterIds : undefined,
        subjectId: chapterIds.length ? undefined : subjectId,
        count: Number(count),
      });
    } catch {
      setBusy(false);
      toast(t('states.errorTitle'));
      return;
    }
    setBusy(false);
    if (!mcqs.length) {
      // Offline, "no questions" is not true: they are on the server.
      toast(online ? t('session.noQuestions') : t('states.offline'));
      return;
    }
    const one = chapterIds.length === 1 ? (chapters.find((c) => c.id === chapterIds[0]) ?? chapterById(chapterIds[0])) : undefined;
    session.start({
      mode: 'practice',
      label:
        chapterIds.length === 1
          ? chapterName(one, lang)
          : `${subjectName(subjectById(subjectId), lang)} · ${t('session.mixed')}`,
      subjectId,
      chapterId: chapterIds.length === 1 ? chapterIds[0] : null,
      mcqs,
    });
    router.replace('/session/mcq');
  }

  return (
    <Screen footer={<Btn title={t('session.start', { n: count })} onPress={start} loading={busy} />}>
      <Header
        title={t('session.setupTitle')}
        sub={chapterParam ? subjectName(subjectById(subjectId), lang) || t('session.setupSub') : t('session.setupSub')}
        back
      />

      {chapterParam ? (
        <>
          <SectionTitle>{t('session.chapter')}</SectionTitle>
          <Card flat style={{ paddingVertical: 0 }}>
            {fixed ? (
              <Item
                title={chapterName(fixed, lang)}
                sub={'mcqCount' in fixed && fixed.mcqCount ? t('study.mcqsSub', { n: fixed.mcqCount }) : undefined}
                icon="book"
                tone="teal"
                last
              />
            ) : (
              <View style={{ flexDirection: rowDir(), alignItems: 'center', gap: S.md, paddingVertical: 14, minHeight: 62 }}>
                <Skeleton w={42} h={42} style={{ borderRadius: 13 }} />
                <View style={{ flex: 1, gap: 7 }}>
                  <Skeleton w="55%" h={13} />
                  <Skeleton w="35%" h={10} />
                </View>
              </View>
            )}
          </Card>
        </>
      ) : (
        <>
          <SectionTitle>{t('session.subject')}</SectionTitle>
          <View style={{ flexDirection: rowDir(), flexWrap: 'wrap', gap: S.sm }}>
            {derived.subjects.map((sid) => (
              <Pill
                key={sid}
                tone={sid === subjectId ? 'teal' : 'grey'}
                onPress={() => setSubjectId(sid)}
                style={{ paddingVertical: 9, paddingHorizontal: 14 }}
              >
                {subjectName(subjectById(sid), lang) || sid}
              </Pill>
            ))}
          </View>

          <SectionTitle
            action={<Small>{chapterIds.length ? t('session.selected', { n: chapterIds.length }) : t('session.allChapters')}</Small>}
          >
            {t('session.chapters')}
          </SectionTitle>
          <Card flat style={{ paddingVertical: 0 }}>
            <Item
              title={t('session.mixed')}
              sub={t('session.mixedSub')}
              icon="cards"
              tone={chapterIds.length === 0 ? 'teal' : 'grey'}
              onPress={() => setChapterIds([])}
              right={<Check on={chapterIds.length === 0} round />}
            />
            {chaptersLoading
              ? [0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: rowDir(),
                      alignItems: 'center',
                      gap: S.md,
                      paddingVertical: 14,
                      minHeight: 62,
                      borderBottomWidth: i === 2 ? 0 : 1,
                      borderBottomColor: C.line,
                    }}
                  >
                    <Skeleton w={42} h={42} style={{ borderRadius: 13 }} />
                    <View style={{ flex: 1, gap: 7 }}>
                      <Skeleton w="55%" h={13} />
                      <Skeleton w="35%" h={10} />
                    </View>
                  </View>
                ))
              : null}
            {!chaptersLoading &&
              chapters.map((c, i) => {
              const on = chapterIds.includes(c.id);
              return (
                <Item
                  key={c.id}
                  title={chapterName(c, lang)}
                  sub={t('study.mcqsSub', { n: c.mcqCount })}
                  icon="book"
                  tone={on ? 'teal' : 'grey'}
                  last={i === chapters.length - 1}
                  onPress={() => setChapterIds((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))}
                  right={<Check on={on} />}
                />
              );
            })}
          </Card>
        </>
      )}

      <SectionTitle>{t('session.howMany')}</SectionTitle>
      <Seg
        value={count}
        onChange={setCount}
        options={[
          { value: '10', label: '10' },
          { value: '20', label: '20' },
          { value: '50', label: '50' },
        ]}
      />
    </Screen>
  );
}
