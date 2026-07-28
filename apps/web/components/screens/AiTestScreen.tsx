'use client';

import { useMemo, useState } from 'react';
import { subjectById, weakTopics } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { ItemButton, Seg } from '@/components/ui/controls';
import { Card, Check, Empty, LinkBtn, SectionTitle } from '@/components/ui/primitives';
import { useApp, useT } from '@/lib/store';

export function AiTestScreen() {
  const { state } = useApp();
  const t = useT();
  const weak = useMemo(() => weakTopics(state.attempts).slice(0, 6), [state.attempts]);
  const [picked, setPicked] = useState<string[]>(() => weakTopics(state.attempts).slice(0, 3).map((w) => w.topic));
  const [count, setCount] = useState<'10' | '15' | '20'>('15');
  const [difficulty, setDifficulty] = useState<'easy' | 'board' | 'hard'>('board');

  return (
    <Page width="focus">
      <PageHead
        back="/tutor"
        backLabel={t('tutor.title')}
        title={t('tutor.aiTestTitle')}
        sub={t('tutor.aiTestSub')}
      />

      {weak.length === 0 ? (
        <Empty
          emoji="🎯"
          title={t('tutor.notEnoughTitle')}
          sub={t('tutor.notEnoughBody')}
          cta={<LinkBtn title={t('tutor.practiceTen')} href="/session/setup" sm />}
        />
      ) : (
        <>
          <SectionTitle action={<span className="text-[13px] text-ink2">{t('session.selected', { n: picked.length })}</span>}>
            {t('tutor.focusOn')}
          </SectionTitle>
          <Card flat className="py-0">
            {weak.map((w, i) => {
              const on = picked.includes(w.topic);
              return (
                <ItemButton
                  key={w.topic}
                  title={w.topic}
                  sub={`${subjectById(w.subjectId)?.name} · ${t('tutor.accuracyOver', { n: w.accuracy, total: w.total })}`}
                  icon="alert"
                  tone={w.accuracy < 50 ? 'red' : 'orange'}
                  last={i === weak.length - 1}
                  right={<Check on={on} />}
                  onClick={() => setPicked((p) => (on ? p.filter((x) => x !== w.topic) : [...p, w.topic]))}
                />
              );
            })}
          </Card>

          <SectionTitle>{t('common.questions')}</SectionTitle>
          <Seg
            value={count}
            onChange={setCount}
            label={t('common.questions')}
            options={[
              { value: '10' as const, label: '10' },
              { value: '15' as const, label: '15' },
              { value: '20' as const, label: '20' },
            ]}
          />

          <SectionTitle>{t('tutor.difficulty')}</SectionTitle>
          <Seg
            value={difficulty}
            onChange={setDifficulty}
            label={t('tutor.difficulty')}
            options={[
              { value: 'easy' as const, label: t('tutor.easyStart') },
              { value: 'board' as const, label: t('tutor.boardLevel') },
              { value: 'hard' as const, label: t('tutor.challenge') },
            ]}
          />

          <Card flat tint="bg-tealtint" border="border-tealtint2" className="mt-4">
            <p className="text-[13px] leading-[1.6] text-ink2">{t('tutor.aiTestNote')}</p>
          </Card>

          <div className="sticky bottom-0 mt-5 bg-paper/95 py-4 backdrop-blur">
            <LinkBtn
              title={t('tutor.generate')}
              href="/session/exam-intro?ai=1"
              variant="orange"
              icon="spark"
              className={`w-full ${picked.length === 0 ? 'pointer-events-none opacity-45' : ''}`}
            />
          </div>
        </>
      )}
    </Page>
  );
}
