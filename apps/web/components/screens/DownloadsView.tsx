'use client';

import type { Chapter } from '@matricmate/core';
import { chapterById, subjectById } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Bar, Card, Empty, Icon, Item, LinkBtn, SectionTitle } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { useApp, useT } from '@/lib/store';

const MB_PER_CHAPTER = 41;
const CAP_MB = 512;

export function DownloadsView() {
  const { state, actions } = useApp();
  const t = useT();
  const toast = useToast();

  const chapters = state.downloads.map(chapterById).filter((c): c is Chapter => !!c);
  const used = chapters.length * MB_PER_CHAPTER;

  const bySubject = chapters.reduce<Record<string, Chapter[]>>((acc, c) => {
    (acc[c.subjectId] ||= []).push(c);
    return acc;
  }, {});

  return (
    <Page width="focus">
      <PageHead back="/account" backLabel={t('account.title')} title={t('downloads.title')} sub={t('downloads.sub')} />

      <Card className="flex items-center gap-3">
        <Icon name="download" className="shrink-0 text-teal" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-extrabold text-ink">{t('downloads.used', { n: used })}</p>
          <div className="mt-2">
            <Bar pct={(used / CAP_MB) * 100} tone="teal" />
          </div>
        </div>
        <span className="shrink-0 text-[13px] text-ink2">{t('downloads.cap', { n: CAP_MB })}</span>
      </Card>

      {chapters.length === 0 ? (
        <div className="mt-6">
          <Empty
            title={t('downloads.emptyTitle')}
            sub={t('downloads.emptyBody')}
            cta={<LinkBtn title={t('downloads.browse')} href="/study" sm variant="line" />}
          />
        </div>
      ) : (
        Object.entries(bySubject).map(([subjectId, list]) => (
          <div key={subjectId}>
            <SectionTitle>{subjectById(subjectId)?.name}</SectionTitle>
            <Card flat className="py-0">
              {list.map((c, i) => (
                <Item
                  key={c.id}
                  href={`/learn/chapter/${c.id}`}
                  title={c.title}
                  sub={t('downloads.perChapter', { n: MB_PER_CHAPTER })}
                  icon="check"
                  tone="green"
                  last={i === list.length - 1}
                  right={
                    <button
                      type="button"
                      aria-label={`Remove ${c.title} from downloads`}
                      onClick={(e) => {
                        e.preventDefault();
                        actions.toggleDownload(c.id);
                        toast(t('study.removedOffline'));
                      }}
                      className="flex h-11 w-11 items-center justify-center rounded-[12px] text-red transition-colors duration-200 hover:bg-redtint"
                    >
                      <Icon name="trash" size={19} />
                    </button>
                  }
                />
              ))}
            </Card>
          </div>
        ))
      )}

      <p className="mt-6 text-[13px] text-ink2">{t('downloads.footnote')}</p>
    </Page>
  );
}
