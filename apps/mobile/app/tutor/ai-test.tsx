import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Btn, Card, Check, Empty, Header, Item, Screen, SectionTitle, Seg, Small, Spacer } from '../../src/components/ui';
import { weakTopics , subjectById } from '@matricmate/core';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, S } from '../../src/theme';

export default function AiTest() {
  const { state } = useApp();
  const t = useT();
  const weak = useMemo(() => weakTopics(state.attempts).slice(0, 6), [state.attempts]);
  const [picked, setPicked] = useState<string[]>(weak.slice(0, 3).map((w) => w.topic));
  const [count, setCount] = useState<'10' | '15' | '20'>('15');
  const [difficulty, setDifficulty] = useState<'easy' | 'board' | 'hard'>('board');

  return (
    <Screen
      footer={
        weak.length ? (
          <Btn
            title={t('tutor.generate')}
            variant="orange"
            icon="spark"
            disabled={picked.length === 0}
            onPress={() => router.replace('/session/exam-intro?ai=1')}
          />
        ) : undefined
      }
    >
      <Header title={t('tutor.aiTestTitle')} sub={t('tutor.aiTestSub')} back />

      {weak.length === 0 ? (
        <Empty
          emoji="🎯"
          title={t('tutor.notEnoughTitle')}
          sub={t('tutor.notEnoughBody')}
          cta={<Btn title={t('tutor.practiceTen')} sm onPress={() => router.replace('/session/setup')} />}
        />
      ) : (
        <>
          <SectionTitle action={<Small>{t('session.selected', { n: picked.length })}</Small>}>
            {t('tutor.focusOn')}
          </SectionTitle>
          <Card flat style={{ paddingVertical: 0 }}>
            {weak.map((w, i) => {
              const on = picked.includes(w.topic);
              return (
                <Item
                  key={w.topic}
                  title={w.topic}
                  sub={`${subjectById(w.subjectId)?.name} · ${t('tutor.accuracyOver', { n: w.accuracy, total: w.total })}`}
                  icon="alert"
                  tone={w.accuracy < 50 ? 'red' : 'orange'}
                  last={i === weak.length - 1}
                  onPress={() => setPicked((p) => (on ? p.filter((x) => x !== w.topic) : [...p, w.topic]))}
                  right={<Check on={on} />}
                />
              );
            })}
          </Card>

          <SectionTitle>{t('common.questions')}</SectionTitle>
          <Seg
            value={count}
            onChange={setCount}
            options={[
              { value: '10', label: '10' },
              { value: '15', label: '15' },
              { value: '20', label: '20' },
            ]}
          />

          <SectionTitle>{t('tutor.difficulty')}</SectionTitle>
          <Seg
            value={difficulty}
            onChange={setDifficulty}
            options={[
              { value: 'easy', label: t('tutor.easyStart') },
              { value: 'board', label: t('tutor.boardLevel') },
              { value: 'hard', label: t('tutor.challenge') },
            ]}
          />

          <Spacer h={S.md} />
          <Card flat tint={C.tealTint}>
            <Small>{t('tutor.aiTestNote')}</Small>
          </Card>
        </>
      )}
    </Screen>
  );
}
