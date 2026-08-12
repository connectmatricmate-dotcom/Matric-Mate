'use client';

import type { FbisePastPaper } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Card, Empty, ExternalLinkBtn, Item, SectionTitle } from '@/components/ui/primitives';
import { useT } from '@/lib/store';

export function PapersScreen({ groups }: { groups: { year: number; papers: FbisePastPaper[] }[] }) {
  const t = useT();
  const hasPapers = groups.some((g) => g.papers.length > 0);

  return (
    <Page width="page">
      <PageHead
        back="/practice"
        backLabel={t('practice.title')}
        title={t('session.papersTitle')}
        sub={t('session.papersSub')}
      />

      {hasPapers ? (
        groups.map(({ year, papers }) => (
          <div key={year}>
            <SectionTitle>{t('session.papersYearHeading', { year })}</SectionTitle>
            <Card flat className="py-0">
              {papers.map((p, i) => (
                <Item
                  key={p.file}
                  icon="doc"
                  title={p.label}
                  sub={t(p.selfHosted ? 'session.papersSelfHostedNote' : 'session.papersHostedNote')}
                  last={i === papers.length - 1}
                  right={<ExternalLinkBtn title={t('session.viewPaper')} href={p.url} variant="line" sm />}
                />
              ))}
            </Card>
          </div>
        ))
      ) : (
        <Empty icon="doc" title={t('session.papersEmptyTitle')} sub={t('session.papersEmptyBody')} />
      )}

      <p className="mt-2 text-[13px] text-ink2">{t('session.papersFootnote')}</p>
    </Page>
  );
}
