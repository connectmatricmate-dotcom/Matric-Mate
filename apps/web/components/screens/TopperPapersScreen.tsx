'use client';

import type { FbiseTopperPaper } from '@matricmate/core';
import { SUBJECT_ICON, subjectById, subjectName, topperYears } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Card, Empty, ExternalLinkBtn, Icon, ScriptText } from '@/components/ui/primitives';
import { useLang, useT } from '@/lib/store';

export function TopperPapersScreen({
  groups,
}: {
  groups: { subjectId: string; scripts: FbiseTopperPaper[] }[];
}) {
  const t = useT();
  const { lang } = useLang();

  return (
    <Page width="page">
      <PageHead
        back="/practice"
        backLabel={t('practice.title')}
        title={t('session.toppersTitle')}
        sub={t('session.toppersSub')}
      />

      <Card border="border-tealtint2" className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-tealtint text-teal">
          <Icon name="award" size={18} />
        </span>
        <p className="text-[13.5px] leading-[1.6] text-ink2">{t('session.toppersIntro')}</p>
      </Card>

      {groups.length === 0 ? (
        <div className="mt-4">
          <Empty icon="award" title={t('session.papersEmptyTitle')} sub={t('session.papersEmptyBody')} />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {groups.map(({ subjectId, scripts }) => {
            const subject = subjectById(subjectId);
            if (!subject || scripts.length === 0) return null;
            return (
              <Card key={subjectId} flat className="flex flex-col gap-3">
                <span className="flex items-center gap-3">
                  <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] bg-tealtint text-teal">
                    <Icon name={SUBJECT_ICON[subjectId] ?? 'book'} size={22} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <ScriptText
                      text={subjectName(subject, lang)}
                      className="text-[15.5px] font-extrabold text-ink"
                    />
                    <span className="block text-[12.5px] text-ink2">{t('session.toppersCount', { n: scripts.length })}</span>
                  </span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {scripts.map((s) => (
                    <ExternalLinkBtn
                      key={s.url}
                      title={t('session.toppersScript', { n: s.n })}
                      href={s.url}
                      variant="line"
                      sm
                    />
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Which examination these are from. Without it a Class 10 student reads
          a list of scripts with no year or level on it as their own. */}
      <p className="mt-4 text-[13px] text-ink2">{t('session.toppersSource', { year: topperYears()[0] ?? '' })}</p>
      <p className="mt-1 text-[13px] text-ink2">{t('session.toppersFootnote')}</p>
    </Page>
  );
}
