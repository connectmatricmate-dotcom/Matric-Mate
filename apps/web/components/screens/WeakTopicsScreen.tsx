'use client';

import { useMemo } from 'react';
import { subjectById, subjectName, weakTopics } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Card, Empty, LinkBtn, ScriptText, SectionTitle } from '@/components/ui/primitives';
import { useApp, useLang, useT } from '@/lib/store';

export function WeakTopicsScreen() {
  const { state } = useApp();
  const t = useT();
  const { lang } = useLang();
  const rows = useMemo(() => weakTopics(state.attempts), [state.attempts]);

  const bySubject = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    (acc[r.subjectId] ||= []).push(r);
    return acc;
  }, {});

  return (
    <Page width="page">
      <PageHead
        back="/progress"
        backLabel={t('progress.title')}
        title={t('progress.weakTitle')}
        sub={t('progress.weakSub')}
      />

      {rows.length === 0 ? (
        <Empty
          icon="search"
          title={t('progress.weakNoneTitle')}
          sub={t('progress.weakNoneBody')}
          cta={<LinkBtn title={t('tutor.practiceTen')} href="/session/setup" sm />}
        />
      ) : (
        Object.entries(bySubject).map(([sid, list]) => (
          <div key={sid}>
            <SectionTitle>{subjectName(subjectById(sid), lang)}</SectionTitle>
            <div className="grid gap-2.5 lg:grid-cols-2">
              {list.map((w) => (
                <Card key={w.topic} flat>
                  <div className="flex items-baseline gap-3">
                    <ScriptText
                      text={w.topic}
                      className="min-w-0 flex-1 text-[14px] font-extrabold text-ink"
                      urduClassName="min-w-0 flex-1 text-[14px] text-ink"
                    />
                    <p className={`font-display text-[17px] tabular ${w.accuracy < 50 ? 'text-red' : 'text-orangedark'}`}>
                      {w.accuracy}%
                    </p>
                  </div>
                  <p className="text-[13px] text-ink2">{t('progress.rightOutOf', { right: w.right, total: w.total })}</p>
                  <div className="mt-4 flex gap-2.5">
                    <LinkBtn title={t('progress.studyBtn')} href={`/learn/chapter/${w.chapterId}`} variant="line" sm className="flex-1" />
                    <LinkBtn title={t('progress.practiceTen')} href={`/session/setup?chapter=${w.chapterId}`} sm className="flex-1" />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}

      <p className="mt-6 text-[13px] text-ink2">{t('progress.weakFootnote')}</p>
    </Page>
  );
}
