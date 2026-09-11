'use client';

import { boardName, type Board, type PastPaperLink } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Card, Empty, ExternalLinkBtn, Item, SectionTitle } from '@/components/ui/primitives';
import { useLang, useT } from '@/lib/store';

export function PapersScreen({ groups, board }: { groups: { year: number; papers: PastPaperLink[] }[]; board: Board }) {
  const t = useT();
  const { lang } = useLang();
  const hasPapers = groups.some((g) => g.papers.length > 0);
  const punjab = board === 'punjab';

  return (
    <Page width="page">
      <PageHead
        back="/practice"
        backLabel={t('practice.title')}
        title={t('session.papersTitle')}
        sub={t(punjab ? 'session.papersSubPunjab' : 'session.papersSub')}
      />

      {hasPapers ? (
        groups.map(({ year, papers }) => (
          <div key={year}>
            <SectionTitle>{t('session.papersYearHeading', { year, board: boardName(board, lang) })}</SectionTitle>
            <Card flat className="py-0">
              {papers.map((p, i) => (
                <Item
                  key={p.key}
                  icon="doc"
                  title={p.label}
                  sub={p.selfHosted ? t('session.papersSelfHostedNote') : t('session.papersHostedNote', { host: p.host })}
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

      <p className="mt-2 text-[13px] text-ink2">{t(punjab ? 'session.papersFootnotePunjab' : 'session.papersFootnote')}</p>
    </Page>
  );
}
