'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { checkAnswerLive, generateMockPaper, readAiSession, subjectById, subjectName } from '@matricmate/core';
import type { AiCheckVerdict, AiPaperItems, AiSessionRead, ShortQ } from '@matricmate/core';
import { createClient } from '@/lib/supabase/client';
import { AiWorking } from '@/components/ui/AiWorking';
import { Page, PageHead } from '@/components/app/Page';
import { Btn, PillButton } from '@/components/ui/controls';
import { Card, Label, Pill, ScriptText, SectionTitle, Skeleton } from '@/components/ui/primitives';
import { ScriptBullets } from '@/components/ui/ScriptList';
import { useToast } from '@/components/ui/toast';
import { session } from '@/lib/session';
import { useApp, useLang, useT } from '@/lib/store';
import { Markdown } from '@/components/ui/Markdown';

/**
 * The board mock paper. Without an id: pick a subject and have one set.
 * With ?id=: the paper itself, in board shape: Section A runs as a timed
 * exam, Sections B and C are written right here and marked by the AI
 * examiner against each question's marking points.
 */
export function PaperScreen({ paperId }: { paperId?: string }) {
  /** Held while a build is in flight so the wait screen can call it off. */
  const cancel = useRef<AbortController | null>(null);
  const { state, derived } = useApp();
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [subjectId, setSubjectId] = useState(derived.subjects[0] ?? 'phy');

  // Keyed by the paper id, so navigating between papers shows the loading
  // state again without a synchronous reset inside the effect.
  const [settled, setSettled] = useState<{ key: string; read: AiSessionRead } | null>(null);
  // A nonce, so asking for the same paper again counts as a new request.
  const [attempt, setAttempt] = useState(0);
  const loadKey = paperId ? `${paperId}:${attempt}` : '';
  useEffect(() => {
    if (!paperId) return;
    let alive = true;
    /* The browser client, passed rather than relied on: the shared one is
       connected by a module side effect in the layout, and a read that depends
       on import order is a read that fails in a way nobody can reproduce. */
    readAiSession(paperId, createClient()).then((read) => {
      if (alive) setSettled({ key: loadKey, read });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey]);
  const loading = !!paperId && settled?.key !== loadKey;
  const read = loading || !paperId ? null : (settled?.read ?? null);
  const paper = read?.ok ? read.row : null;

  async function build() {
    if (busy) return;
    setBusy(true);
    const controller = new AbortController();
    cancel.current = controller;
    const res = await generateMockPaper({ subjectId, medium: state.settings.contentMedium }, controller.signal);
    cancel.current = null;
    setBusy(false);
    // Stopped on purpose: see the note in the AI builder.
    if (controller.signal.aborted) return;
    if (!res.ok) {
      const note = {
        offline: t('tutor.offline'),
        quota: t('tutor.limitToast'),
        rate: t('tutor.slowDown'),
        plan: t('tutor.planNeeded'),
        refused: t('tutor.refused'),
        error: t('tutor.errorReply'),
      }[res.reason];
      toast(note);
      return;
    }
    router.push(`/tutor/paper?id=${res.sessionId}`);
  }

  if (!paperId) {
    return (
      <Page width="focus">
        {/* Half a minute of real work, so it gets the whole viewport rather
            than a button that dims. See components/ui/AiWorking. */}
        <AiWorking
          open={busy}
          title={t('tutor.paperBuilding')}
          onCancel={() => {
            cancel.current?.abort();
            setBusy(false);
            toast(t('tutor.buildStopped'));
          }}
        />
        <PageHead back="/tutor" backLabel={t('tutor.title')} title={t('tutor.paperTitle')} sub={t('tutor.paperSub')} />
        <SectionTitle>{t('tutor.pickSubject')}</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {derived.subjects.map((sid) => (
            <PillButton key={sid} tone={sid === subjectId ? 'teal' : 'grey'} onClick={() => setSubjectId(sid)}>
              {subjectName(subjectById(sid), lang) || sid}
            </PillButton>
          ))}
        </div>
        <Card flat tint="bg-tealtint" className="mt-4">
          <p className="text-[13px] text-ink2">{t('tutor.costNote', { n: 3, limit: 50 })}</p>
        </Card>
        <div className="mt-5">
          <Btn
            title={t('tutor.buildIt')}
            variant="orange"
            className="w-full"
            loading={busy}
            onClick={() => void build()}
          />
        </div>
      </Page>
    );
  }

  if (loading) {
    return (
      <Page width="focus">
        <PageHead back="/tutor" backLabel={t('tutor.title')} title={t('tutor.paperTitle')} />
        <Skeleton className="h-32 w-full" />
      </Page>
    );
  }

  const items = paper?.items as AiPaperItems | undefined;
  if (!paper || !items) {
    /*
     * Two failures, told apart.
     *
     * A paper that is genuinely gone and a read that did not come back both
     * used to render "Couldn't load this", which is why a real report of a
     * broken mock paper could not be diagnosed from the screenshot: the row
     * was in the database, complete, the whole time. Retrying helps with
     * exactly one of these, so only one of them offers it.
     */
    const gone = read?.ok === false && read.reason === 'missing';
    return (
      <Page width="focus">
        <PageHead back="/tutor" backLabel={t('tutor.title')} title={t('tutor.paperTitle')} />
        <Card flat tint={gone ? 'bg-orangetint' : 'bg-redtint'} border={gone ? 'border-orange' : 'border-red'}>
          <p className={`text-[13.5px] font-extrabold ${gone ? 'text-orangedark' : 'text-red'}`}>
            {t(gone ? 'tutor.paperGoneTitle' : 'tutor.paperLoadFailed')}
          </p>
          <p className="mt-0.5 text-[13px] text-ink2">{t(gone ? 'tutor.paperGoneBody' : 'tutor.paperLoadFailedBody')}</p>
          {gone ? (
            <Btn title={t('tutor.buildIt')} variant="orange" sm className="mt-3" onClick={() => router.push('/tutor/paper')} />
          ) : (
            <Btn title={t('common.retry')} variant="line" sm className="mt-3" onClick={() => setAttempt((n) => n + 1)} />
          )}
          {/* The reason, quietly, for the next bug report. Not a stack trace,
              one short line, and only when there is something to say. */}
          {read?.ok === false && read.detail ? (
            <p className="mt-2 text-[11px] text-ink3">{read.detail}</p>
          ) : null}
        </Card>
      </Page>
    );
  }

  const startSectionA = () => {
    session.start({
      mode: 'exam',
      label: paper.title,
      subjectId: paper.subjectId ?? subjectId,
      chapterId: null,
      mcqs: items.mcqs,
      durationSec: items.mcqs.length * 90,
      aiGenerated: true,
    });
    router.push('/session/exam');
  };

  return (
    <Page width="focus">
      <PageHead back="/tutor" backLabel={t('tutor.title')} title={paper.title} sub={t('tutor.aiMade')} />

      <Card border="border-orange" className="flex flex-col gap-1.5">
        <Label className="text-orangedark">{t('tutor.paperSectionA')}</Label>
        <p className="text-[13px] text-ink2">
          {t('session.examRules', { n: items.mcqs.length, min: Math.round((items.mcqs.length * 90) / 60) })}
        </p>
        <div className="mt-1">
          <Btn title={t('tutor.paperStart')} variant="orange" sm onClick={startSectionA} />
        </div>
      </Card>

      <div className="mt-5"><SectionTitle>{t('tutor.paperSectionB')}</SectionTitle></div>
      <div className="flex flex-col gap-2.5">
        {items.shortQs.map((q, n) => (
          <PaperQuestion key={q.id} n={n + 1} q={q} medium={state.settings.contentMedium} />
        ))}
      </div>

      <div className="mt-5"><SectionTitle>{t('tutor.paperSectionC')}</SectionTitle></div>
      <div className="flex flex-col gap-2.5">
        {items.longQs.map((q, n) => (
          <PaperQuestion key={q.id} n={n + 1} q={q} medium={state.settings.contentMedium} />
        ))}
      </div>
    </Page>
  );
}

/** One written question: write, get marked, compare with the model answer. */
function PaperQuestion({ n, q, medium }: { n: number; q: ShortQ; medium: string }) {
  const t = useT();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [written, setWritten] = useState('');
  const [checking, setChecking] = useState(false);
  const [verdict, setVerdict] = useState<AiCheckVerdict | null>(null);
  const [revealed, setRevealed] = useState(false);

  async function checkMine() {
    if (!written.trim() || checking) return;
    setChecking(true);
    const res = await checkAnswerLive({
      question: q.q,
      modelAnswer: q.answer,
      points: q.points,
      marks: q.marks,
      answer: written.trim(),
      medium,
    });
    setChecking(false);
    if (!res.ok) {
      toast(t('tutor.errorReply'));
      return;
    }
    setVerdict(res.verdict);
    setRevealed(true);
  }

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Label className="text-teal">Q{n}</Label>
        <Pill tone="grey">{t('session.marks', { n: q.marks })}</Pill>
      </div>
      <ScriptText text={q.q} className="text-[14.5px] font-extrabold leading-[1.55] text-ink" urduClassName="text-[14.5px] text-ink" />
      {open ? (
        <>
          <div className="field-shell rounded-[14px] border-[1.5px] border-line bg-paper transition-[border-color,box-shadow] duration-200">
            <textarea
              value={written}
              onChange={(e) => setWritten(e.target.value)}
              placeholder={t('tutor.checkPlaceholder')}
              aria-label={t('tutor.checkPlaceholder')}
              rows={3}
              className="w-full resize-y bg-transparent p-3 text-[14px] leading-[1.6] text-ink outline-none placeholder:text-ink3"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Btn
              title={checking ? t('tutor.checkBusy') : t('tutor.checkTitle')}
              variant="orange"
              sm
              className="flex-1"
              loading={checking}
              disabled={!written.trim()}
              onClick={() => void checkMine()}
            />
            {!revealed ? (
              <Btn title={t('session.revealAnswer')} variant="line" sm className="flex-1" onClick={() => setRevealed(true)} />
            ) : null}
          </div>
          {verdict ? (
            <Card
              flat
              tint={verdict.score >= verdict.maxMarks ? 'bg-greentint' : 'bg-orangetint'}
              border={verdict.score >= verdict.maxMarks ? 'border-green' : 'border-orange'}
            >
              <p className="font-display text-[17px] text-ink">{t('tutor.checkScore', { a: verdict.score, b: verdict.maxMarks })}</p>
              <Markdown text={verdict.feedback} className="mt-1 text-[13.5px] leading-[1.6] text-ink" />
            </Card>
          ) : null}
          {revealed ? (
            <Card flat tint="bg-greentint" border="border-green">
              <Label className="text-green">{t('session.modelAnswer')}</Label>
              <Markdown text={q.answer} className="mt-1 text-[14px] leading-[1.6] text-ink" />
              {q.points.length ? (
                <>
                  {/* Named, like Android names them. Unlabelled bullets under a
                      model answer read as more of the answer, when they are
                      the marks an examiner is actually looking for. */}
                  <Label className="mt-3 block text-ink2">{t('session.markingPoints')}</Label>
                  <ScriptBullets items={q.points} className="text-[13px] text-ink2" listClassName="mt-2 flex flex-col gap-1" />
                </>
              ) : null}
            </Card>
          ) : null}
        </>
      ) : (
        <button type="button" className="self-start text-[13px] font-extrabold text-teal hover:underline" onClick={() => setOpen(true)}>
          {t('tutor.checkTitle')}
        </button>
      )}
    </Card>
  );
}
