'use client';

import type { PaperSection, PastPaper } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Card, Label, LinkBtn, Pill, Ur } from '@/components/ui/primitives';
import { useT } from '@/lib/store';

export function PaperViewer({
  paper,
  subjectName,
  sections,
  isReal,
}: {
  paper: PastPaper;
  subjectName: string;
  sections: PaperSection[];
  isReal: boolean;
}) {
  const t = useT();

  return (
    <Page width="read">
      <PageHead
        back="/session/papers"
        backLabel={t('session.papersTitle')}
        title={`FBISE ${paper.year} · ${paper.session}`}
        sub={subjectName}
        actions={isReal ? <Pill tone="green">{t('session.fullPaper')}</Pill> : undefined}
      />

      <Card>
        {/* Masthead, laid out the way the printed board paper is */}
        <p className="text-center font-display text-[15px] text-ink">FEDERAL BOARD SSC-I EXAMINATION</p>
        <p className="mt-0.5 text-center text-[13px] font-extrabold text-ink">
          {subjectName.toUpperCase()} · {paper.year}
        </p>
        <p className="mt-1 text-center">
          <Label>
            {t('session.paperMeta', { marks: paper.marks, h: Math.floor(paper.minutes / 60), m: paper.minutes % 60 })}
          </Label>
        </p>

        <hr className="my-4 border-line" />

        {sections.map((sec) => (
          <section key={sec.heading} className="mb-6 last:mb-0">
            <div className="mb-1.5 flex items-center gap-2.5">
              {sec.urdu ? (
                <Ur block className="min-w-0 flex-1 text-[15px]">{sec.heading}</Ur>
              ) : (
                <h2 className="min-w-0 flex-1 text-[13.5px] font-extrabold text-ink">{sec.heading}</h2>
              )}
              {sec.marks ? <Pill tone="grey">{sec.marks}</Pill> : null}
            </div>
            <div className="flex flex-col gap-1.5">
              {sec.lines.map((line, i) =>
                sec.urdu ? (
                  <Ur block key={i} className={`block text-[14.5px] ${i === 0 ? 'text-ink' : 'text-ink2'}`}>
                    {line}
                  </Ur>
                ) : (
                  <p key={i} className={`text-[13px] leading-[1.65] ${i === 0 ? 'font-extrabold text-ink' : 'text-ink2'}`}>
                    {line}
                  </p>
                )
              )}
            </div>
          </section>
        ))}
      </Card>

      <p className="mt-4 text-[13px] text-ink2">{isReal ? t('session.realPaperNote') : t('session.paperViewerNote')}</p>

      <LinkBtn
        title={t('session.practiceThisPaper')}
        href={`/session/exam-intro?subject=${paper.subjectId}&paper=${paper.year}`}
        className="mt-5 w-full md:w-auto"
      />
    </Page>
  );
}
