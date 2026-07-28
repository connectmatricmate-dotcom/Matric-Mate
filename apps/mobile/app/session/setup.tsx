import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Btn, Card, Header, Item, Pill, Screen, SectionTitle, Seg, Small, Spacer, useToast } from '../../src/components/ui';
import { api } from '../../src/core/api';
import { CHAPTERS, chapterById, subjectById } from '../../src/core/content';
import { useApp } from '../../src/store/app';
import { session } from '../../src/store/session';
import { C, S } from '../../src/theme';

export default function SessionSetup() {
  const { chapter: chapterParam } = useLocalSearchParams<{ chapter?: string }>();
  const { derived, state } = useApp();
  const toast = useToast();

  const initialChapter = chapterParam ? chapterById(chapterParam) : undefined;
  const [subjectId, setSubjectId] = useState(initialChapter?.subjectId ?? derived.subjects[0] ?? 'phy');
  const [chapterIds, setChapterIds] = useState<string[]>(initialChapter ? [initialChapter.id] : []);
  const [count, setCount] = useState<'10' | '20' | '50'>('10');
  const [busy, setBusy] = useState(false);

  const chapters = useMemo(() => (CHAPTERS[subjectId] ?? []).filter((c) => !c.premium || state.premium.active), [subjectId, state.premium.active]);

  useEffect(() => {
    if (!initialChapter) setChapterIds([]);
  }, [subjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function start() {
    setBusy(true);
    const mcqs = await api.getMcqs({
      chapterIds: chapterIds.length ? chapterIds : undefined,
      subjectId: chapterIds.length ? undefined : subjectId,
      count: Number(count),
    });
    setBusy(false);
    if (!mcqs.length) {
      toast('No questions for that selection yet');
      return;
    }
    session.start({
      mode: 'practice',
      label: chapterIds.length === 1 ? `${chapterById(chapterIds[0])?.title} — practice` : `${subjectById(subjectId)?.name} — mixed practice`,
      subjectId,
      chapterId: chapterIds.length === 1 ? chapterIds[0] : null,
      mcqs,
    });
    router.replace('/session/mcq');
  }

  return (
    <Screen footer={<Btn title={`Start — ${count} questions`} onPress={start} loading={busy} />}>
      <Header title="New MCQ session" sub="Pick what you want to practise" back />

      <SectionTitle>Subject</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S.sm }}>
        {derived.subjects.map((sid) => (
          <Pill key={sid} tone={sid === subjectId ? 'teal' : 'grey'} onPress={() => setSubjectId(sid)} style={{ paddingVertical: 8, paddingHorizontal: 14 }}>
            {subjectById(sid)?.name ?? sid}
          </Pill>
        ))}
      </View>

      <SectionTitle action={<Small>{chapterIds.length ? `${chapterIds.length} selected` : 'all chapters'}</Small>}>
        Chapters
      </SectionTitle>
      <Card flat style={{ paddingVertical: 2 }}>
        <Item
          title="Mixed — all chapters"
          sub="Questions from everything you've studied"
          icon="cards"
          tone={chapterIds.length === 0 ? 'green' : 'grey'}
          onPress={() => setChapterIds([])}
          right={chapterIds.length === 0 ? <Pill tone="green" icon="check" /> : undefined}
        />
        {chapters.map((c, i) => {
          const on = chapterIds.includes(c.id);
          return (
            <Item
              key={c.id}
              title={`Ch ${c.number} · ${c.title}`}
              sub={`${c.mcqCount} questions`}
              icon="book"
              tone={on ? 'green' : 'grey'}
              last={i === chapters.length - 1}
              onPress={() => setChapterIds((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))}
              right={on ? <Pill tone="green" icon="check" /> : undefined}
            />
          );
        })}
      </Card>

      <SectionTitle>How many?</SectionTitle>
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
      <Small>
        {state.premium.active ? 'Premium: unlimited practice.' : 'Free mode: 5 questions a day. Premium unlocks unlimited practice.'}
      </Small>
    </Screen>
  );
}
