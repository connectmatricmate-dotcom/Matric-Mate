'use client';

import { isUrduScript } from '@matricmate/core';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { SessionHeader } from '@/components/app/SessionHeader';
import { Btn } from '@/components/ui/controls';
import { Card, Icon, Label, ScriptText } from '@/components/ui/primitives';
import { Confirm } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { useApp, useT } from '@/lib/store';
import { session } from '@/lib/session';
import { NoSession } from './NoSession';
import { Page, Rail, Split, Work } from '@/components/app/Page';

/**
 * Papers already handed in. A paper is submitted once: coming back to its URL
 * afterwards goes to the result rather than grading, and recording, it again.
 */
const handedIn = new WeakSet<object>();

/** Seconds left on a paper, from the clock rather than from a counter. */
function secondsLeft(s: { startedAt: number; durationSec?: number }, now: number): number {
  return Math.max(0, (s.durationSec ?? 1800) - Math.floor((now - s.startedAt) / 1000));
}

export function ExamScreen() {
  const { actions } = useApp();
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const s = session.current;

  const [i, setI] = useState(0);
  /* Picks live in the session as they are made, not only in this screen. They
     used to be component state, so leaving the paper for a moment and coming
     back wiped every answer and put the clock back to 30:00. */
  const [answers, setAnswers] = useState<Record<string, number>>(() =>
    Object.fromEntries(Object.values(s?.answers ?? {}).flatMap((a) => (a.chosen == null ? [] : [[a.mcqId, a.chosen]]))),
  );
  const [flags, setFlags] = useState<string[]>(() =>
    Object.values(s?.answers ?? {}).flatMap((a) => (a.flagged ? [a.mcqId] : [])),
  );
  /* The time left is worked out from when the paper started. A one-second
     interval counting down paused whenever the tab was in the background or
     the phone locked, so a student could stop the clock by switching apps. */
  const [now, setNow] = useState(() => Date.now());
  const left = s ? secondsLeft(s, now) : 0;
  const [confirm, setConfirm] = useState(false);
  const [leaving, startLeaving] = useTransition();

  const submit = useCallback(() => {
    // Nothing to grade is not a paper: an empty one used to save as 0/0.
    if (!s || !s.mcqs.length || handedIn.has(s)) return;
    handedIn.add(s);
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
          // Each answer under its own chapter's subject. A weak-topic paper
          // spans subjects, and filing it all under one filed Chemistry
          // mistakes as Physics.
          subjectId: m.chapterId.split('-')[0] || s.subjectId,
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

  /* One pick, kept in the session straight away so it survives a remount.
     Graded properly on submit; `correct` here only keeps the record honest. */
  function choose(mcqId: string, n: number, answer: number) {
    setAnswers((a) => ({ ...a, [mcqId]: n }));
    session.answer({ mcqId, chosen: n, confidence: null, correct: n === answer, flagged: flags.includes(mcqId) });
  }

  function toggleFlag(mcqId: string, flagged: boolean) {
    const next = flagged ? flags.filter((x) => x !== mcqId) : [...flags, mcqId];
    setFlags(next);
    const chosen = answers[mcqId] ?? null;
    const m = s?.mcqs.find((q) => q.id === mcqId);
    session.answer({ mcqId, chosen, confidence: null, correct: m ? chosen === m.answer : false, flagged: !flagged });
  }

  useEffect(() => {
    if (!s?.mcqs.length) return;
    if (handedIn.has(s)) {
      router.replace('/session/result');
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [s, router]);

  // Time up ends the paper, exactly as an invigilator would.
  useEffect(() => {
    if (s?.mcqs.length && left === 0) submit();
  }, [s, left, submit]);

  /*
   * Leaving a paper that is still open, by the sidebar, the tabs, a reload or
   * closing the tab, silently threw it away: no answers saved, no result, the
   * clock still running in memory. The intro warns about it; now the paper
   * asks first. Android turns the hardware Back into the same question.
   */
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const open = !!s?.mcqs.length && !handedIn.has(s) && !leaving;
  useEffect(() => {
    if (!open) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaveTo(url.pathname + url.search);
    };
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [open]);

  const mcq = s?.mcqs[i];
  // A refreshed test starts again from its intro, where a test is set up.
  if (!s || !mcq) return <NoSession href="/session/exam-intro" label={t('practice.exam')} />;

  const unanswered = s.mcqs.filter((m) => answers[m.id] == null).length;
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  const urgent = left < 120;
  const flagged = flags.includes(mcq.id);

  // The map is rendered in two places: inline under the options on a phone,
  // and in the rail on a desktop, where a phone strip floating mid-column was
  // exactly what made this screen read as an unfinished mobile layout.
  const questionMap = (
    <div className="flex flex-wrap justify-center gap-1.5 xl:justify-start">
      {s.mcqs.map((m, n) => {
        const answered = answers[m.id] != null;
        const isFlagged = flags.includes(m.id);
        const current = n === i;
        const style = current
          ? 'bg-orange text-onbrand'
          : answered
            ? 'bg-teal text-onbrand'
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
            className={`h-10 w-10 pointer-coarse:h-11 pointer-coarse:w-11 rounded-[12px] text-[12.5px] font-extrabold transition-[background-color,filter] duration-200 hover:brightness-95 ${style}`}
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
                toggleFlag(mcq.id, flagged);
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
          <div className="mt-4 md:rounded-[22px] md:border md:border-line md:bg-card md:p-7 md:shadow-[0_5px_14px_var(--shadow-soft)]">
          <h1 className="mb-4"><ScriptText text={mcq.q} className="font-display text-[19px] leading-[1.5] text-ink md:text-[22px]" urduClassName="text-[18px] text-ink" /></h1>

          <div className="flex flex-col gap-2.5">
            {mcq.options.map((opt, n) => {
              const sel = answers[mcq.id] === n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={sel}
                  onClick={() => choose(mcq.id, n, mcq.answer)}
                  // The option's own direction; see McqScreen.
                  dir={isUrduScript(opt) ? 'rtl' : 'ltr'}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-[15px] border-[1.5px] px-3.5 py-3.5 text-start transition-colors duration-200 ${
                    sel ? 'border-teal bg-tealtint' : 'border-line bg-card hover:border-tealtint2'
                  }`}
                >
                  <span
                    className={`flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-[9px] text-[12.5px] font-extrabold ${
                      sel ? 'bg-teal text-onbrand' : 'bg-grey text-ink2'
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
          <div className="mt-5 xl:hidden">
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

        {/* desktop: the map earns its own card in the margin. Below xl the map
            is inline and the rail would only add an empty gap under the
            buttons; `contents` at xl keeps the rail the grid's own child, so it
            still sticks. */}
        <div className="hidden xl:contents">
        <Rail>
          <Card flat>
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <Label>{t('session.questionOf', { a: i + 1, b: s.mcqs.length })}</Label>
              <span className="text-[12px] font-extrabold text-ink2 tabular">
                {s.mcqs.length - unanswered}/{s.mcqs.length}
              </span>
            </div>
            {questionMap}
            <p className="mt-3 text-[12.5px] leading-[1.5] text-ink2 rtl:leading-[1.9]">{t('session.jumpHint')}</p>
          </Card>
        </Rail>
        </div>
      </Split>

      <Confirm
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('session.submitTitle')}
        body={`${unanswered ? t('session.unanswered', { n: unanswered }) : t('session.allAnswered')} ${t('session.noChangeAfter')}`}
        confirmLabel={t('session.submitNow')}
        cancelLabel={t('session.keepWorking')}
        tone="orange"
        loading={leaving}
        onConfirm={submit}
      />

      <Confirm
        open={leaveTo !== null}
        onClose={() => setLeaveTo(null)}
        title={t('session.leaveTestTitle')}
        body={t('session.leaveTestBody')}
        confirmLabel={t('session.leaveTest')}
        cancelLabel={t('session.keepWorking')}
        onConfirm={() => {
          const to = leaveTo;
          setLeaveTo(null);
          // The paper is abandoned, not handed in: nothing is recorded.
          session.clear();
          if (to) router.push(to);
        }}
      />
    </Page>
  );
}
