import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Btn, Card, Empty, Header, Item, Pill, Screen, SectionTitle, Seg, Small, Spacer } from '../../src/components/ui';
import { weakTopics } from '../../src/core/domain';
import { subjectById } from '../../src/core/content';
import { useApp } from '../../src/store/app';
import { C, S } from '../../src/theme';

export default function AiTest() {
  const { state } = useApp();
  const weak = useMemo(() => weakTopics(state.attempts).slice(0, 6), [state.attempts]);
  const [picked, setPicked] = useState<string[]>(weak.slice(0, 3).map((w) => w.topic));
  const [count, setCount] = useState<'10' | '15' | '20'>('15');
  const [difficulty, setDifficulty] = useState<'easy' | 'board' | 'hard'>('board');

  return (
    <Screen
      footer={
        <Btn
          title="Generate my test"
          variant="orange"
          icon="spark"
          disabled={picked.length === 0}
          onPress={() => router.replace('/session/exam-intro?ai=1')}
        />
      }
    >
      <Header title="AI test" sub="Built from your weak topics" back />

      {weak.length === 0 ? (
        <Empty
          emoji="🎯"
          title="Not enough data yet"
          sub="Answer a few questions first — then the AI knows what to drill you on."
          cta={<Btn title="Practice 10 MCQs" sm onPress={() => router.replace('/session/setup')} />}
        />
      ) : (
        <>
          <SectionTitle action={<Small>{picked.length} selected</Small>}>Focus on</SectionTitle>
          <Card flat style={{ paddingVertical: 2 }}>
            {weak.map((w, i) => {
              const on = picked.includes(w.topic);
              return (
                <Item
                  key={w.topic}
                  title={w.topic}
                  sub={`${subjectById(w.subjectId)?.name} · ${w.accuracy}% accuracy over ${w.total} questions`}
                  icon="alert"
                  tone={w.accuracy < 50 ? 'red' : 'orange'}
                  last={i === weak.length - 1}
                  onPress={() => setPicked((p) => (on ? p.filter((x) => x !== w.topic) : [...p, w.topic]))}
                  right={on ? <Pill tone="green" icon="check" /> : <Pill tone="grey">add</Pill>}
                />
              );
            })}
          </Card>

          <SectionTitle>Questions</SectionTitle>
          <Seg
            value={count}
            onChange={setCount}
            options={[
              { value: '10', label: '10' },
              { value: '15', label: '15' },
              { value: '20', label: '20' },
            ]}
          />

          <SectionTitle>Difficulty</SectionTitle>
          <Seg
            value={difficulty}
            onChange={setDifficulty}
            options={[
              { value: 'easy', label: 'Easy start' },
              { value: 'board', label: 'Board level' },
              { value: 'hard', label: 'Challenge' },
            ]}
          />

          <Spacer h={S.md} />
          <Card flat tint={C.tealTint}>
            <Small>
              In the live app the AI writes fresh questions from your chapter content, and an admin approves them
              before students see them. This demo picks from the existing bank.
            </Small>
          </Card>
        </>
      )}
    </Screen>
  );
}
