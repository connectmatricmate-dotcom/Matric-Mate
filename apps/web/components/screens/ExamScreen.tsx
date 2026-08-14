'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { SessionHeader } from '@/components/app/SessionHeader';
import { Btn } from '@/components/ui/controls';
import { Card, Icon, Label, ScriptText } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { useApp, useT } from '@/lib/store';
import { session } from '@/lib/session';
import { NoSession } from './NoSession';
import { Page, Rail, Split, Work } from '@/components/app/Page';

export function ExamScreen() {
  const { actions } = useApp();
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const s = session.current;

  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [flags, setFlags] = useState<string[]>([]);
  const [left, setLeft] = useState(s?.durationSec ?? 1800);
  const [confirm, setConfirm] = useState(false);
  const [leaving, startLeaving] = useTransition();

  const submit = useCallback(() => {
    if (!s) return;
    // Grade into the session, collect the store writes, and commit them as ONE
    // update: a 50-question paper written attempt-by-attempt notified every
    // store subscriber 50 times before the redirect could even start.
    const recorded: Parameters<typeof actions.recordAttempts>[0] = [];
    s.mcqs.forEach((m) => {
      const chosen = answers[m.id] ?? null;
      const correct = chosen === m.answer;
      session.answer({ mcqId: m.id, chosen, confidence: null, correct, flagged: flags.includes(m.id) });
      if (chosen != null) {
        recorded.push({
          mcqId: m.id,
          chapterId: m.chapterId,
          subjectId: s.subjectId,
          topic: m.topic,
          correct,
          confidence: null,
          mode: 'exam',
        });
      }
    });
    actions.recordAttempts(recorded);
    startLeaving(() => router.replace('/session/result'));
  }, [s, answers, flags, actions, router]);

  useEffect(() => {
    const timer = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  // Time up ends the paper, exactly as an invigilator would.
  useEffect(() => {
    if (left === 0) submit();
  }, [left, submit]);

  const mcq = s?.mcqs[i];
  if (!s || !mcq) return <NoSession />;

  const unanswered = s.mcqs.filter((m) => answers[m.id] == null).length;
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  const urgent = left < 120;
  const flagged = flags.includes(mcq.id);

  // The map is rendered in two places: inline under the options on a phone,
  // and in the rail on a desktop, where a phone strip floating mid-column was
  // exactly what made this screen read as an unfinished mobile layout.
  const questionMap = (
    <div className="flex flex-wrap justify-center gap-1.5 lg:justify-start">
      {s.mcqs.map((m, n) => {
        const answered = answers[m.id] != null;
        const isFlagged = flags.includes(m.id);
        const current = n === i;
        const style = current
          ? 'bg-orange text-white'
          : answered
            ? 'bg-teal text-white'
            : isFlagged
              ? 'bg-orangetint text-orangedark'
              : 'bg-grey text-ink2';
        return (
          <button
            key={m.id}
            type="button"
            aria-label={`${t('session.questionOf', { a: n + 1, b: s.mcqs.length })}`}
            aria-current={current ? 'true' : undefined}
            onClick={() => setI(n)}
            className={`h-10 w-10 rounded-[12px] text-[12.5px] font-extrabold transition-colors duration-200 ${style}`}
          >
            {n + 1}
          </button>
        );
      })}
    </div>
  );

  return (
    <Page>
      <SessionHeader
        onClose={() => setConfirm(true)}
        closeLabel={t('common.close')}
        pct={((s.mcqs.length - unanswered) / s.mcqs.length) * 100}
        label={t('session.questionOf', { a: i + 1, b: s.mcqs.length })}
        segments={s.mcqs.map((m, j) =>
          j === i ? 'current' : answers[m.id] != null ? 'done' : 'todo',
        )}
        right={
          <>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 font-display text-[15px] tabular ${
                urgent ? 'bg-redtint text-red' : 'bg-orangetint text-orangedark'
              }`}
            >
              <Icon name="clock" size={15} strokeWidth={2.4} />
              {mm}:{ss}
            </span>
            <button
              type="button"
              aria-pressed={flagged}
              aria-label={flagged ? t('session.unflag') : t('session.flag')}
              onClick={() => {
                setFlags((f) => (flagged ? f.filter((x) => x !== mcq.id) : [...f, mcq.id]));
                toast(flagged ? t('session.flagRemoved') : t('session.flagged'));
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] transition-colors duration-200 hover:bg-paper"
            >
              <Icon name="star" className={flagged ? 'text-orange' : 'text-ink3'} />
            </button>
          </>
        }
      />

      <Split>
        <Work>
          {/* Same desktop framing as McqScreen: the paper the student writes on. */}
          <div className="mt-4 md:rounded-[22px] md:border md:border-line md:bg-card md:p-7 md:shadow-[0_5px_14px_rgba(15,80,100,0.07)]">
          <h1 className="mb-4"><ScriptText text={mcq.q} className="font-display text-[19px] leading-[1.5] text-ink md:text-[22px]" urduClassName="text-[18px] text-ink" /></h1>

          <div className="flex flex-col gap-2.5">
            {mcq.options.map((opt, n) => {
              const sel = answers[mcq.id] === n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={sel}
                  onClick={() => setAnswers((a) => ({ ...a, [mcq.id]: n }))}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-[15px] border-[1.5px] px-3.5 py-3.5 text-left transition-colors duration-200 ${
                    sel ? 'border-teal bg-tealtint' : 'border-line bg-card hover:border-tealtint2'
                  }`}
                >
                  <span
                    className={`flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-[9px] text-[12.5px] font-extrabold ${
                      sel ? 'bg-teal text-white' : 'bg-grey text-ink2'
                    }`}
                  >
                    {String.fromCharCode(65 + n)}
                  </span>
                  <span className="min-w-0 flex-1"><ScriptText text={opt} className="text-[14.5px] leading-[1.5] text-ink" urduClassName="text-[14px] text-ink" /></span>
                </button>
              );
            })}
          </div>
          </div>

          {/* phone: the map sits under the options */}
          <div className="mt-5 lg:hidden">
            {questionMap}
            <p className="mt-2 text-center text-[13px] text-ink2">{t('session.jumpHint')}</p>
          </div>

          <div className="mt-6 flex gap-2.5">
            <Btn title={t('session.submit')} variant="line" className="flex-1" onClick={() => setConfirm(true)} />
            <Btn
              title={i + 1 >= s.mcqs.length ? t('session.lastQuestion') : t('common.next')}
              className="flex-1"
              disabled={i + 1 >= s.mcqs.length}
              onClick={() => setI(Math.min(s.mcqs.length - 1, i + 1))}
            />
          </div>
        </Work>

        {/* desktop: the map earns its own card in the margin */}
        <Rail>
          <Card flat className="hidden lg:block">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <Label>{t('session.questionOf', { a: i + 1, b: s.mcqs.length })}</Label>
              <span className="text-[12px] font-extrabold text-ink2 tabular">
                {s.mcqs.length - unanswered}/{s.mcqs.length}
              </span>
            </div>
            {questionMap}
            <p className="mt-3 text-[12.5px] leading-[1.5] text-ink2">{t('session.jumpHint')}</p>
          </Card>
        </Rail>
      </Split>

      <Sheet open={confirm} onClose={() => setConfirm(false)} title={t('session.submitTitle')}>
        <p className="text-[13.5px] leading-[1.6] text-ink2">
          {unanswered ? t('session.unanswered', { n: unanswered }) : t('session.allAnswered')} {t('session.noChangeAfter')}
        </p>
        <Btn title={t('session.submitNow')} variant="orange" onClick={submit} loading={leaving} className="mt-5 w-full" />
        <Btn title={t('session.keepWorking')} variant="ghost" onClick={() => setConfirm(false)} className="mt-2 w-full" />
      </Sheet>
    </Page>
  );
}
