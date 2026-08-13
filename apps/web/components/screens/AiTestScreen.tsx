'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  chaptersFor,
  fetchAiSession,
  fetchAiSessions,
  generateAiSession,
  normalizeAiMcqs,
  subjectById,
  weakTopics,
} from '@matricmate/core';
import type { AiSessionKind, AiSessionRow } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Btn, ItemButton, PillButton, Seg } from '@/components/ui/controls';
import { Card, Check, SectionTitle } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { session } from '@/lib/session';
import { useApp, useT } from '@/lib/store';

const KIND_LABEL = { mcq: 'tutor.kindMcq', flashcards: 'tutor.kindCards', blanks: 'tutor.kindBlanks', shortq: 'tutor.kindShortq' } as const;

/**
 * The AI practice builder. Pick a chapter, a practice type and a size, and
 * the tutor writes a fresh set from that chapter's own text, saved to the
 * student's account so it opens on the phone too.
 */
export function AiTestScreen() {
  const { state, derived } = useApp();
  const t = useT();
  const toast = useToast();
  const router = useRouter();

  const [kind, setKind] = useState<AiSessionKind>('mcq');
  const [subjectId, setSubjectId] = useState(derived.subjects[0] ?? 'phy');
  const chapters = useMemo(() => chaptersFor(subjectId), [subjectId]);
  const [chapterTouched, setChapterTouched] = useState<string | null>(null);
  const fallbackChapter = state.lastChapterId ?? chapters[0]?.id ?? '';
  const chapterId = chapterTouched && chapters.some((c) => c.id === chapterTouched) ? chapterTouched : chapters.some((c) => c.id === fallbackChapter) ? fallbackChapter : (chapters[0]?.id ?? '');
  const [count, setCount] = useState<'5' | '8' | '12'>('8');
  const [busy, setBusy] = useState(false);

  const weak = useMemo(() => weakTopics(state.attempts).slice(0, 3), [state.attempts]);

  const [sets, setSets] = useState<AiSessionRow[]>([]);
  useEffect(() => {
    let alive = true;
    fetchAiSessions().then((rows) => {
      if (alive) setSets(rows.filter((r) => r.kind !== 'paper'));
    });
    return () => {
      alive = false;
    };
  }, []);

  function openSet(k: AiSessionKind, sessionId: string, items: unknown[], forChapter: string) {
    if (k === 'mcq') {
      session.start({
        mode: 'practice',
        label: t('tutor.aiMade'),
        subjectId: forChapter.split('-')[0],
        chapterId: forChapter,
        mcqs: normalizeAiMcqs(items as Parameters<typeof normalizeAiMcqs>[0], forChapter),
        aiGenerated: true,
      });
      router.push('/session/mcq');
      return;
    }
    router.push(`/session/${k}?chapter=${forChapter}&ai=${sessionId}`);
  }

  async function build() {
    if (!chapterId || busy) return;
    setBusy(true);
    const res = await generateAiSession({ kind, chapterId, count: Number(count), medium: state.settings.contentMedium });
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
    openSet(kind, res.sessionId, res.items, chapterId);
  }

  async function reopen(row: AiSessionRow) {
    if (row.kind === 'paper') return;
    if (row.kind === 'mcq') {
      const s = await fetchAiSession(row.id);
      if (!s) {
        toast(t('states.errorTitle'));
        return;
      }
      openSet('mcq', row.id, s.items as unknown[], s.chapterId ?? '');
      return;
    }
    openSet(row.kind, row.id, [], row.chapterId ?? '');
  }

  return (
    <Page width="focus">
      <PageHead back="/tutor" backLabel={t('tutor.title')} title={t('tutor.builderTitle')} sub={t('tutor.builderSub')} />

      <SectionTitle>{t('tutor.pickSubject')}</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {derived.subjects.map((sid) => (
          <PillButton key={sid} tone={sid === subjectId ? 'teal' : 'grey'} onClick={() => setSubjectId(sid)}>
            {subjectById(sid)?.name ?? sid}
          </PillButton>
        ))}
      </div>

      <div className="mt-5"><SectionTitle>{t('tutor.pickChapter')}</SectionTitle></div>
      <Card flat className="py-0">
        {chapters.map((c, i) => (
          <ItemButton
            key={c.id}
            title={`${c.number}. ${c.title}`}
            icon="book"
            last={i === chapters.length - 1}
            onClick={() => setChapterTouched(c.id)}
            right={<Check on={c.id === chapterId} />}
          />
        ))}
      </Card>

      <div className="mt-5"><SectionTitle>{t('common.questions')}</SectionTitle></div>
      <Seg
        value={kind}
        onChange={setKind}
        options={(Object.keys(KIND_LABEL) as AiSessionKind[]).map((k) => ({ value: k, label: t(KIND_LABEL[k]) }))}
      />
      <div className="mt-2">
        <Seg
          value={count}
          onChange={setCount}
          options={[
            { value: '5', label: '5' },
            { value: '8', label: '8' },
            { value: '12', label: '12' },
          ]}
        />
      </div>

      <Card flat tint="bg-tealtint" className="mt-4">
        <p className="text-[13px] text-ink2">{t('tutor.costNote', { n: 2, limit: 50 })}</p>
      </Card>

      <div className="mt-5">
        <Btn title={busy ? t('tutor.building') : t('tutor.buildIt')} variant="orange" className="w-full" loading={busy} onClick={build} />
      </div>

      {weak.length ? (
        <>
          <div className="mt-6"><SectionTitle>{t('tutor.aiTestTitle')}</SectionTitle></div>
          <button
            type="button"
            className="w-full text-left"
            onClick={() =>
              router.push(
                `/session/exam-intro?ai=1&topics=${encodeURIComponent(weak.map((w) => w.topic).join('|'))}&count=15&difficulty=board`,
              )
            }
          >
            <Card border="border-orange" className="transition-colors duration-200 hover:brightness-[0.99]">
              <p className="text-[13.5px] font-extrabold text-ink">{t('tutor.aiTestSub')}</p>
              <p className="mt-0.5 text-[12.5px] text-ink2">{weak.map((w) => w.topic).join(' · ')}</p>
            </Card>
          </button>
        </>
      ) : null}

      {sets.length ? (
        <>
          <div className="mt-6"><SectionTitle>{t('tutor.recentSets')}</SectionTitle></div>
          <Card flat className="py-0">
            {sets.slice(0, 5).map((s, i) => (
              <ItemButton
                key={s.id}
                title={s.title}
                sub={`${t(KIND_LABEL[s.kind as AiSessionKind])} · ${t('tutor.aiMade')}`}
                icon="spark"
                last={i === Math.min(4, sets.length - 1)}
                onClick={() => void reopen(s)}
              />
            ))}
          </Card>
        </>
      ) : null}
    </Page>
  );
}
