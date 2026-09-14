'use client';

import { useEffect, useState } from 'react';
import { buildCareer, fetchCareer, formatDate, subjectById, subjectName, type AiFail, type CareerState } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Btn } from '@/components/ui/controls';
import { Bar, Card, Icon, Label, ScriptText, Skeleton } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { useApp, useLang, useT } from '@/lib/store';

/**
 * Career guidance: the student's results, subject by subject, and what an AI
 * counsellor reads in them (see /api/ai/career).
 *
 * The numbers come first and are always shown, so the guidance under them is
 * visibly about this student and not a horoscope. Below enough answers there
 * is no button at all, only how many more to answer: advice from a handful of
 * questions would be a guess, and it would cost them a question to get it.
 */
export function CareerView() {
  const t = useT();
  const { lang } = useLang();
  const { state } = useApp();
  const toast = useToast();
  const userId = state.user?.id ?? '';
  const [career, setCareer] = useState<CareerState | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void fetchCareer().then((res) => {
      if (!alive) return;
      if (res.ok) {
        setCareer(res.data);
        setFailed(false);
      } else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [userId, reload]);

  const reasonText = (r: AiFail['reason']) =>
    ({
      offline: t('tutor.offline'),
      quota: t('tutor.limitToast'),
      rate: t('tutor.slowDown'),
      plan: t('tutor.planNeeded'),
      refused: t('career.failed'),
      syllabus: t('career.failed'),
      error: t('career.failed'),
    })[r];

  async function build() {
    if (busy) return;
    setBusy(true);
    const res = await buildCareer(lang);
    setBusy(false);
    if (res.ok) setCareer(res.data);
    else toast(reasonText(res.reason));
  }

  const date = (iso: string) => formatDate(iso, lang, { day: 'numeric', month: 'long' });
  const report = career?.report ?? null;
  const subjects = career?.stats.filter((s) => s.answered > 0) ?? [];

  return (
    <Page width="focus">
      <PageHead back="/progress" backLabel={t('progress.title')} title={t('career.title')} sub={t('career.cardSub')} />

      {!career && !failed ? (
        <CareerSkeleton />
      ) : failed || !career ? (
        <Card flat tint="bg-redtint" border="border-red">
          <p className="text-[13.5px] font-extrabold text-red">{t('career.failed')}</p>
          <Btn title={t('common.retry')} variant="line" sm className="mt-3" onClick={() => setReload((n) => n + 1)} />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {subjects.length ? (
            <Card flat>
              <h2 className="mb-3 font-display text-[16px] text-ink">{t('career.yourResults')}</h2>
              <div className="flex flex-col gap-3">
                {subjects.map((s) => (
                  <div key={s.subject}>
                    <span className="flex items-baseline justify-between gap-2">
                      <ScriptText
                        text={subjectName(subjectById(s.subject), lang) || s.subject}
                        className="min-w-0 flex-1 truncate text-[13.5px] font-extrabold text-ink"
                      />
                      <span className="shrink-0 text-[12.5px] text-ink2 tabular">
                        {t('career.answered', { n: s.answered })} · <span className="font-extrabold text-ink">{s.accuracy}%</span>
                      </span>
                    </span>
                    <span className="mt-1.5 block">
                      <Bar pct={s.accuracy} tone={s.answered < career.need ? 'orange' : 'teal'} />
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {!career.enough && !report ? (
            <Card flat tint="bg-tealtint" border="border-tealtint2">
              <p className="font-display text-[17px] text-ink">{t('career.notEnoughTitle')}</p>
              <p className="mt-1 text-[13.5px] leading-[1.65] text-ink2 rtl:leading-[1.9]">{t('career.notEnoughBody', { n: career.need })}</p>
            </Card>
          ) : null}

          {career.enough && !report ? (
            <Card className="flex flex-col items-start gap-3">
              <p className="text-[14px] leading-[1.65] text-ink2 rtl:leading-[1.9]">{t('career.intro')}</p>
              <Btn
                title={busy ? t('career.building') : t('career.build')}
                variant="orange"
                icon="spark"
                loading={busy}
                onClick={() => void build()}
                className="w-full sm:w-auto"
              />
            </Card>
          ) : null}

          {report ? (
            <>
              <Card tint="bg-tealtint" border="border-teal">
                <ScriptText text={report.summary} className="text-[14.5px] leading-[1.7] text-ink" urduClassName="text-[14.5px] text-ink" />
                {career.createdAt ? (
                  <p className="mt-2 text-[12px] text-ink2">
                    {t('career.basedOn', { n: career.answered, s: subjects.length, date: date(career.createdAt) })}
                  </p>
                ) : null}
              </Card>

              <Section title={t('career.streams')} icon="gradCap">
                {report.streams.map((s) => (
                  <Point key={s.name} name={s.name} why={s.why} />
                ))}
              </Section>

              <Section title={t('career.fields')} icon="target">
                {report.fields.map((f) => (
                  <Point key={f.name} name={f.name} why={f.why} />
                ))}
              </Section>

              <Section title={t('career.strengths')} icon="award">
                {report.strengths.map((s) => (
                  <Point key={s.subject} name={s.subject} why={s.why} />
                ))}
              </Section>

              <Card flat>
                <Label>{t('career.nextSteps')}</Label>
                <ol className="mt-2 flex flex-col gap-2">
                  {report.nextSteps.slice(0, 3).map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange text-[11px] font-extrabold text-onbrand">
                        {i + 1}
                      </span>
                      <ScriptText
                        text={step.replace(/^\s*\d{1,2}[.)]\s*/, '')}
                        className="text-[13.5px] leading-[1.6] text-ink"
                        urduClassName="text-[13.5px] text-ink"
                      />
                    </li>
                  ))}
                </ol>
              </Card>

              <p className="text-[12.5px] leading-[1.6] text-ink2 rtl:leading-[1.9]">{t('career.disclaimer')}</p>

              {career.nextAt ? (
                <p className="text-[12.5px] text-ink3">{t('career.rebuildAfter', { date: date(career.nextAt) })}</p>
              ) : career.enough ? (
                <Btn
                  title={busy ? t('career.building') : t('career.rebuild')}
                  variant="line"
                  icon="refresh"
                  sm
                  loading={busy}
                  onClick={() => void build()}
                  className="self-start"
                />
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </Page>
  );
}

function Section({ title, icon, children }: { title: string; icon: 'gradCap' | 'target' | 'award'; children: React.ReactNode }) {
  return (
    <Card flat>
      <h2 className="mb-2 flex items-center gap-2 font-display text-[16px] text-ink">
        <Icon name={icon} size={18} className="shrink-0 text-teal" />
        {title}
      </h2>
      <ul className="flex flex-col">{children}</ul>
    </Card>
  );
}

function Point({ name, why }: { name: string; why: string }) {
  return (
    <li className="border-b border-line py-2.5 last:border-b-0">
      <ScriptText text={name} className="text-[14px] font-extrabold text-ink" urduClassName="text-[14px] text-ink" />
      <ScriptText text={why} className="mt-0.5 text-[13px] leading-[1.6] text-ink2" urduClassName="text-[13px] text-ink2" />
    </li>
  );
}

/** Shaped like the results card and the button under it. */
function CareerSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Card flat className="flex flex-col gap-3">
        <Skeleton className="h-4 w-32" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-3/5" />
            <Skeleton className="h-[7px] w-full rounded-full" />
          </div>
        ))}
      </Card>
      <Skeleton className="h-[120px] w-full rounded-[16px]" />
    </div>
  );
}
