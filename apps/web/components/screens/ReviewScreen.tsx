'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Page, PageHead } from '@/components/app/Page';
import { Btn, PillButton } from '@/components/ui/controls';
import { Card, Label, LinkBtn, Pill } from '@/components/ui/primitives';
import { useT } from '@/lib/store';
import { session } from '@/lib/session';
import { NoSession } from './NoSession';

type Filter = 'all' | 'wrong' | 'flagged';

export function ReviewScreen() {
  const t = useT();
  const router = useRouter();
  const s = session.current;
  const [filter, setFilter] = useState<Filter>('wrong');
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (!s) return [];
    return s.mcqs
      .map((m) => ({ mcq: m, a: s.answers[m.id] }))
      .filter(({ a }) => (filter === 'all' ? true : filter === 'wrong' ? a && !a.correct : a?.flagged))
      .sort((x, y) => Number(!!x.a?.correct) - Number(!!y.a?.correct));
  }, [s, filter]);

  if (!s) return <NoSession />;

  const wrongCount = Object.values(s.answers).filter((a) => !a.correct).length;
  const flagCount = Object.values(s.answers).filter((a) => a.flagged).length;

  return (
    <Page width="focus">
      <PageHead back="/practice" backLabel={t('practice.title')} title={t('session.reviewTitle')} sub={s.label} />

      <div className="flex flex-wrap gap-2">
        <PillButton tone={filter === 'all' ? 'teal' : 'grey'} onClick={() => setFilter('all')}>
          {`${t('session.all')} · ${s.mcqs.length}`}
        </PillButton>
        <PillButton tone={filter === 'wrong' ? 'red' : 'grey'} onClick={() => setFilter('wrong')}>
          {`${t('session.wrongOnly')} · ${wrongCount}`}
        </PillButton>
        <PillButton tone={filter === 'flagged' ? 'orange' : 'grey'} onClick={() => setFilter('flagged')}>
          {`${t('session.flaggedOnly')} · ${flagCount}`}
        </PillButton>
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        {rows.length === 0 ? (
          <Card flat className="py-6 text-center">
            <span className="text-[30px]">🎉</span>
            <p className="mt-1.5 text-[14.5px] text-ink">
              {filter === 'wrong' ? t('session.allCorrect') : t('session.nothingFlagged')}
            </p>
          </Card>
        ) : (
          rows.map(({ mcq, a }) => {
            const isOpen = open === mcq.id;
            const wrong = a && !a.correct;
            return (
              <Card
                key={mcq.id}
                flat
                className={`border-l-4 ${wrong ? 'border-l-red' : 'border-l-green opacity-90'}`}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : mcq.id)}
                  className="w-full text-left"
                >
                  <p className="text-[13.5px] font-extrabold leading-[1.5] text-ink">{mcq.q}</p>
                  <span className="mt-2 flex flex-wrap gap-2">
                    {a?.chosen != null ? (
                      <Pill tone={wrong ? 'red' : 'green'}>
                        {t('session.yourAnswer', { a: String.fromCharCode(65 + a.chosen) })}
                      </Pill>
                    ) : (
                      <Pill tone="grey">{t('session.notAnswered')}</Pill>
                    )}
                    <Pill tone="green">{t('session.correctAnswer', { a: String.fromCharCode(65 + mcq.answer) })}</Pill>
                    {a?.confidence != null ? (
                      <Pill tone="orange">{[t('session.conf0'), t('session.conf1'), t('session.conf2')][a.confidence]}</Pill>
                    ) : null}
                  </span>
                  {!isOpen ? <span className="mt-1.5 block text-[13px] text-ink2">{t('session.tapForWhy')}</span> : null}
                </button>

                {isOpen ? (
                  <div className="mt-3">
                    <Label className="text-teal">{t('session.why')}</Label>
                    <p className="mt-0.5 text-[13.5px] leading-[1.6] text-ink">{mcq.explanation}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <LinkBtn title={t('session.askAi')} href={`/tutor/chat?q=${encodeURIComponent(mcq.q)}`} variant="line" sm />
                      <LinkBtn title={t('session.readInChapter')} href={`/learn/reader/${mcq.chapterId}`} variant="ghost" sm />
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })
        )}
      </div>

      <Btn
        title={t('common.done')}
        className="mt-6 w-full md:w-auto"
        onClick={() => {
          session.clear();
          router.replace('/practice');
        }}
      />
    </Page>
  );
}
