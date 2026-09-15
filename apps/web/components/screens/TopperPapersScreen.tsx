'use client';

import type { FbiseTopperPaper } from '@matricmate/core';
import { SUBJECT_ICON, subjectById, subjectName, topperYears } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Card, Empty, ExternalLinkBtn, Icon, ScriptText } from '@/components/ui/primitives';
import { useLang, useT } from '@/lib/store';

export function TopperPapersScreen({
  groups,
  punjab = false,
}: {
  groups: { subjectId: string; scripts: FbiseTopperPaper[] }[];
  /** A Punjab student reached this by link: say why there is nothing, rather than show FBISE's. */
  punjab?: boolean;
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

      {/* FBISE's own words about FBISE's scripts. A Punjab student is told
          why there are none instead, not given another board's pitch. */}
      {punjab ? null : (
        <Card border="border-tealtint2" className="mb-4 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-tealtint text-teal">
            <Icon name="award" size={18} />
          </span>
          <p className="text-[13.5px] leading-[1.6] text-ink2 rtl:leading-[1.9]">{t('session.toppersIntro')}</p>
        </Card>
      )}

      {groups.length === 0 ? (
        <div>
          <Empty
            icon="award"
            title={t(punjab ? 'session.toppersNonePunjabTitle' : 'session.papersEmptyTitle')}
            sub={t(punjab ? 'session.toppersNonePunjabBody' : 'session.papersEmptyBody')}
          />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
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
                    <span className="block text-[12.5px] text-ink2">
                      {/* One of anything is singular: it read "1 scripts". */}
                      {scripts.length === 1 ? t('session.toppersCountOne') : t('session.toppersCount', { n: scripts.length })}
                    </span>
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
          a list of scripts with no year or level on it as their own. Only
          when there are scripts to be from. */}
      {groups.length ? (
        <>
          <p className="mt-4 text-[13px] text-ink2">{t('session.toppersSource', { year: topperYears()[0] ?? '' })}</p>
          <p className="mt-1 text-[13px] text-ink2">{t('session.toppersFootnote')}</p>
        </>
      ) : null}
    </Page>
  );
}
