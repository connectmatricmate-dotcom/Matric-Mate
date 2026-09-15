'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { checkAnswerLive, fetchAiSessions, generateMockPaper, isUrduScript, readAiSession, subjectById, subjectMedium, subjectName } from '@matricmate/core';
import type { AiCheckVerdict, AiFail, AiPaperItems, AiSessionRead, AiSessionRow, ShortQ } from '@matricmate/core';
import { createClient } from '@/lib/supabase/client';
import { AiWorking } from '@/components/ui/AiWorking';
import { Page, PageHead } from '@/components/app/Page';
import { Btn, ItemButton, PillButton } from '@/components/ui/controls';
import { Card, Label, Pill, ScriptText, SectionTitle, Skeleton } from '@/components/ui/primitives';
import { ScriptBullets } from '@/components/ui/ScriptList';
import { useToast } from '@/components/ui/toast';
import { session } from '@/lib/session';
import { useApp, useLang, useT } from '@/lib/store';
import { useTutorQuota } from '@/lib/use-tutor-quota';
import { Markdown } from '@/components/ui/Markdown';
import { ReportAi } from '@/components/app/ReportAi';

/** Every failure a marking request can come back with, in words. */
function useFailNote() {
  const t = useT();
  return (reason: AiFail['reason']) =>
    ({
      offline: t('tutor.offline'),
      quota: t('tutor.limitToast'),
      rate: t('tutor.slowDown'),
      plan: t('tutor.planNeeded'),
      trial: t('tutor.notInTrial'),
      refused: t('tutor.refused'),
      syllabus: t('tutor.notInSyllabus'),
      error: t('tutor.errorReply'),
    })[reason];
}

/** Whether a check-answer reply is a verdict; see ShortQScreen. */
const isVerdict = (v: unknown): v is AiCheckVerdict =>
  !!v && typeof (v as AiCheckVerdict).score === 'number' && Array.isArray((v as AiCheckVerdict).missed);

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
  const [quota] = useTutorQuota();
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const router = useRouter();
  const failNote = useFailNote();
  const [busy, setBusy] = useState(false);
  const [subjectId, setSubjectId] = useState(derived.subjects[0] ?? 'phy');
  /* Picked before the store has loaded, from the fallback list; moved to the
     student's first subject when their own list arrives, unless they have
     already tapped one. Same rule as the MCQ setup. */
  const [seenSubjects, setSeenSubjects] = useState(derived.subjects);
  if (seenSubjects !== derived.subjects) {
    setSeenSubjects(derived.subjects);
    if (derived.subjects.length && !derived.subjects.includes(subjectId)) setSubjectId(derived.subjects[0]);
  }

  /* Papers already set, so one can be opened again. The only way back to a
     finished paper was its URL; the builder's cancel toast promised it would
     be "in your sets", and it was nowhere. */
  const [papers, setPapers] = useState<AiSessionRow[]>([]);
  useEffect(() => {
    if (paperId) return;
    let alive = true;
    fetchAiSessions(createClient()).then((rows) => {
      if (alive) setPapers(rows.filter((r) => r.kind === 'paper'));
    });
    return () => {
      alive = false;
    };
  }, [paperId]);

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
    // The subject's own language: an Urdu or English paper is set in that
    // language for every student, whatever medium they read in.
    const res = await generateMockPaper(
      { subjectId, medium: subjectMedium(subjectId, state.onboarding?.board, state.settings.contentMedium) },
      controller.signal,
    );
    cancel.current = null;
    setBusy(false);
    // Stopped on purpose: see the note in the AI builder.
    if (controller.signal.aborted) return;
    if (!res.ok) {
      toast(failNote(res.reason));
      return;
    }
    // A refusal used to arrive looking like a success and open
    // /tutor/paper?id=undefined, which could only ever say "Could not load".
    if (!res.sessionId) {
      toast(t('tutor.refused'));
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
        <PageHead back="/tutor" backLabel={t('tutor.title')} title={t('tutor.paperTitle')} sub={t(state.onboarding?.board === 'punjab' ? 'tutor.paperSubPunjab' : 'tutor.paperSub')} />
        <SectionTitle>{t('tutor.pickSubject')}</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {derived.subjects.map((sid) => (
            <PillButton key={sid} tone={sid === subjectId ? 'teal' : 'grey'} onClick={() => setSubjectId(sid)}>
              {subjectName(subjectById(sid), lang) || sid}
            </PillButton>
          ))}
        </div>
        <Card flat tint="bg-tealtint" className="mt-4">
          {/* The student's own allowance: a free trial has five a day, not fifty. */}
          <p className="text-[13px] text-ink2">{t('tutor.costNote', { n: 3, limit: quota?.limit ?? derived.aiLimit })}</p>
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

        {papers.length ? (
          <>
            <div className="mt-6"><SectionTitle>{t('tutor.recentPapers')}</SectionTitle></div>
            <Card flat className="py-0">
              {papers.slice(0, 5).map((p, i, list) => (
                <ItemButton
                  key={p.id}
                  title={p.title}
                  sub={`${subjectName(subjectById(p.subjectId ?? ''), lang) || t('tutor.paperTitle')} · ${t('tutor.aiMade')}`}
                  icon="doc"
                  last={i === list.length - 1}
                  onClick={() => router.push(`/tutor/paper?id=${p.id}`)}
                />
              ))}
            </Card>
          </>
        ) : null}
      </Page>
    );
  }

  if (loading) {
    // Shaped like the paper: the Section A card, a section title, then the
    // written questions, so nothing jumps when it arrives.
    return (
      <Page width="focus">
        <PageHead back="/tutor" backLabel={t('tutor.title')} title={t('tutor.paperTitle')} />
        <Skeleton className="h-[118px] w-full rounded-[16px]" />
        <Skeleton className="mt-6 mb-2 h-4 w-48" />
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[92px] w-full rounded-[16px]" />
          ))}
        </div>
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
            <p className="mt-2 text-[11px] text-ink3 wrap-anywhere">{read.detail}</p>
          ) : null}
        </Card>
      </Page>
    );
  }

  // Marked in the paper's own subject language; see the builder above.
  const paperMedium = subjectMedium(paper.subjectId ?? subjectId, state.onboarding?.board, state.settings.contentMedium);

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
      <PageHead back="/tutor" backLabel={t('tutor.title')} title={paper.title} titleUrdu={isUrduScript(paper.title)} sub={t('tutor.aiMade')} />

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
          <PaperQuestion key={q.id} n={n + 1} q={q} medium={paperMedium} subjectId={paper.subjectId ?? subjectId} />
        ))}
      </div>

      <div className="mt-5"><SectionTitle>{t('tutor.paperSectionC')}</SectionTitle></div>
      <div className="flex flex-col gap-2.5">
        {items.longQs.map((q, n) => (
          <PaperQuestion key={q.id} n={n + 1} q={q} medium={paperMedium} subjectId={paper.subjectId ?? subjectId} />
        ))}
      </div>
    </Page>
  );
}

/** One written question: write, get marked, compare with the model answer. */
function PaperQuestion({ n, q, medium, subjectId }: { n: number; q: ShortQ; medium: string; subjectId: string }) {
  const t = useT();
  const toast = useToast();
  const failNote = useFailNote();
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
      // The paper's subject: a free trial's answers are marked only in the
      // trial's own subject, and the server refuses a check that does not say.
      subjectId,
    });
    setChecking(false);
    // The actual reason. Every failure used to read "something went wrong,
    // try again", a spent daily allowance included.
    if (!res.ok) {
      toast(failNote(res.reason));
      return;
    }
    if (!isVerdict(res.verdict)) {
      toast(t('tutor.refused'));
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
              // 16px on phones, or iOS zooms in on focus and stays there.
              className="w-full resize-y bg-transparent p-3 text-[16px] leading-[1.6] text-ink outline-none placeholder:text-ink3 md:text-[14px] rtl:leading-[1.9]"
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
              <ReportAi surface="paper" excerpt={verdict.feedback} />
            </Card>
          ) : null}
          {revealed ? (
            <Card flat tint="bg-greentint" border="border-green">
              <Label className="text-green">{t('session.modelAnswer')}</Label>
              <Markdown text={q.answer} className="mt-1 text-[14px] leading-[1.6] text-ink" />
              <ReportAi surface="paper" refId={q.id} excerpt={`${q.q}\n\n${q.answer}`} />
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
        <button type="button" className="-my-1 inline-flex min-h-11 items-center self-start text-[13px] font-extrabold text-teal hover:underline" onClick={() => setOpen(true)}>
          {t('tutor.checkTitle')}
        </button>
      )}
    </Card>
  );
}
