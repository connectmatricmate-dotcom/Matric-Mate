'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { checkAnswerLive, fetchAiSession, generateMockPaper, subjectById } from '@matricmate/core';
import type { AiCheckVerdict, AiPaperItems, AiSessionRow, ShortQ } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Btn, PillButton } from '@/components/ui/controls';
import { Card, Label, Pill, SectionTitle, Skeleton } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { session } from '@/lib/session';
import { useApp, useT } from '@/lib/store';
import { Markdown } from '@/components/ui/Markdown';

/**
 * The board mock paper. Without an id: pick a subject and have one set.
 * With ?id=: the paper itself, in board shape: Section A runs as a timed
 * exam, Sections B and C are written right here and marked by the AI
 * examiner against each question's marking points.
 */
export function PaperScreen({ paperId }: { paperId?: string }) {
  const { state, derived } = useApp();
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [subjectId, setSubjectId] = useState(derived.subjects[0] ?? 'phy');

  // Keyed by the paper id, so navigating between papers shows the loading
  // state again without a synchronous reset inside the effect.
  const [settled, setSettled] = useState<{ key: string; row: AiSessionRow | null } | null>(null);
  useEffect(() => {
    if (!paperId) return;
    let alive = true;
    fetchAiSession(paperId).then((row) => {
      if (alive) setSettled({ key: paperId, row });
    });
    return () => {
      alive = false;
    };
  }, [paperId]);
  const loading = !!paperId && settled?.key !== paperId;
  const paper = loading || !paperId ? null : settled?.row ?? null;

  async function build() {
    if (busy) return;
    setBusy(true);
    const res = await generateMockPaper({ subjectId, medium: state.settings.contentMedium });
    setBusy(false);
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
        <PageHead back="/tutor" backLabel={t('tutor.title')} title={t('tutor.paperTitle')} sub={t('tutor.paperSub')} />
        <SectionTitle>{t('tutor.pickSubject')}</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {derived.subjects.map((sid) => (
            <PillButton key={sid} tone={sid === subjectId ? 'teal' : 'grey'} onClick={() => setSubjectId(sid)}>
              {subjectById(sid)?.name ?? sid}
            </PillButton>
          ))}
        </div>
        <Card flat tint="bg-tealtint" className="mt-4">
          <p className="text-[13px] text-ink2">{t('tutor.costNote', { n: 3, limit: 50 })}</p>
        </Card>
        <div className="mt-5">
          <Btn
            title={busy ? t('tutor.paperBuilding') : t('tutor.buildIt')}
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
    return (
      <Page width="focus">
        <PageHead back="/tutor" backLabel={t('tutor.title')} title={t('tutor.paperTitle')} />
        <Card flat tint="bg-redtint" border="border-red">
          <p className="text-[13.5px] font-extrabold text-red">{t('states.errorTitle')}</p>
          <p className="mt-0.5 text-[13px] text-ink2">{t('states.errorBody')}</p>
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
      <p className="text-[14.5px] font-extrabold leading-[1.55] text-ink">{q.q}</p>
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
                <ul className="mt-2 flex flex-col gap-1">
                  {q.points.map((p, i) => (
                    <li key={i} className="text-[13px] text-ink2">
                      • {p}
                    </li>
                  ))}
                </ul>
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
