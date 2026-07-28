'use client';

import { useMemo, useState } from 'react';
import type { PastPaper } from '@matricmate/core';
import { subjectById } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Card, Icon, LinkBtn, Pill } from '@/components/ui/primitives';
import { useApp, useT } from '@/lib/store';

const PAPER_SUBJECTS = ['phy', 'chem', 'bio', 'math', 'urd', 'eng'];

export function PapersScreen({ papers }: { papers: PastPaper[] }) {
  const { derived } = useApp();
  const t = useT();
  const [subjectId, setSubjectId] = useState('phy');

  const subjects = useMemo(() => derived.subjects.filter((s) => PAPER_SUBJECTS.includes(s)), [derived.subjects]);
  const shown = papers.filter((p) => p.subjectId === subjectId);

  return (
    <Page width="page">
      <PageHead
        back="/practice"
        backLabel={t('practice.title')}
        title={t('session.papersTitle')}
        sub={t('session.papersSub')}
      />

      <div className="flex flex-wrap gap-2">
        {subjects.map((sid) => (
          <button
            key={sid}
            type="button"
            aria-pressed={sid === subjectId}
            onClick={() => setSubjectId(sid)}
            className={`min-h-10 rounded-full px-3.5 py-2 text-[13px] font-extrabold transition-colors duration-200 ${
              sid === subjectId ? 'bg-tealtint text-teal' : 'bg-grey text-ink2 hover:brightness-95'
            }`}
          >
            {subjectById(sid)?.name ?? sid}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-2.5 lg:grid-cols-2">
        {shown.map((p) => (
          <Card key={p.id} flat>
            <div className="flex items-center gap-3">
              <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[12px] bg-tealtint text-teal">
                <Icon name="doc" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-extrabold text-ink">
                  FBISE {p.year} · {p.session}
                </p>
                <p className="text-[13px] text-ink2">
                  {t('session.paperMeta', { marks: p.marks, h: Math.floor(p.minutes / 60), m: p.minutes % 60 })}
                </p>
              </div>
              {p.downloaded ? (
                <Pill tone="green" icon="check">
                  {t('audio.offline')}
                </Pill>
              ) : null}
            </div>
            <div className="mt-4 flex gap-2.5">
              <LinkBtn title={t('session.viewPaper')} href={`/session/paper/${p.id}`} variant="line" sm className="flex-1" />
              <LinkBtn
                title={t('session.practiceAsExam')}
                href={`/session/exam-intro?subject=${p.subjectId}&paper=${p.year}`}
                sm
                className="flex-1"
              />
            </div>
          </Card>
        ))}
      </div>

      <p className="mt-4 text-[13px] text-ink2">{t('session.papersFootnote')}</p>
    </Page>
  );
}
