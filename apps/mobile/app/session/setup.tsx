import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Btn, Card, Check, Header, Item, Pill, Screen, SectionTitle, Seg, Skeleton, Small, Spacer, useToast } from '../../src/components/ui';
import { api , chapterById, subjectById } from '@matricmate/core';
import { useAsync } from '../../src/core/useAsync';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { session } from '../../src/store/session';
import { C, S } from '../../src/theme';

export default function SessionSetup() {
  const { chapter: chapterParam } = useLocalSearchParams<{ chapter?: string }>();
  const { derived, state } = useApp();
  const t = useT();
  const toast = useToast();

  const initialChapter = chapterParam ? chapterById(chapterParam) : undefined;
  const [subjectId, setSubjectId] = useState(initialChapter?.subjectId ?? derived.subjects[0] ?? 'phy');
  const [chapterIds, setChapterIds] = useState<string[]>(initialChapter ? [initialChapter.id] : []);
  const [count, setCount] = useState<'10' | '20' | '50'>('10');
  const [busy, setBusy] = useState(false);

  const { data: chapterList, loading: chaptersLoading } = useAsync(() => api.getChapters(subjectId), [subjectId]);
  const chapters = useMemo(
    () => (chapterList ?? []).filter((c) => !c.premium || state.premium.active),
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
      toast(t('session.noQuestions'));
      return;
    }
    session.start({
      mode: 'practice',
      label:
        chapterIds.length === 1
          ? `${chapterById(chapterIds[0])?.title}`
          : `${subjectById(subjectId)?.name} · ${t('session.mixed')}`,
      subjectId,
      chapterId: chapterIds.length === 1 ? chapterIds[0] : null,
      mcqs,
    });
    router.replace('/session/mcq');
  }

  return (
    <Screen footer={<Btn title={t('session.start', { n: count })} onPress={start} loading={busy} />}>
      <Header title={t('session.setupTitle')} sub={t('session.setupSub')} back />

      <SectionTitle>{t('session.subject')}</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
        {derived.subjects.map((sid) => (
          <Pill
            key={sid}
            tone={sid === subjectId ? 'teal' : 'grey'}
            onPress={() => setSubjectId(sid)}
            style={{ paddingVertical: 9, paddingHorizontal: 14 }}
          >
            {subjectById(sid)?.name ?? sid}
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
                  flexDirection: 'row',
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
              title={c.title}
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
      <Spacer h={S.md} />
      <Small>{state.premium.active ? t('session.premiumActive') : t('session.premiumNote')}</Small>
    </Screen>
  );
}
