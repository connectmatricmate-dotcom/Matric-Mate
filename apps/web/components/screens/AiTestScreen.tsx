'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  chapterName,
  fetchAiSession,
  fetchAiSessions,
  generateAiSession,
  normalizeAiMcqs,
  subjectById,
  subjectMedium,
  subjectName,
  weakTopics,
} from '@matricmate/core';
import type { AiFail, AiSessionKind, AiSessionRow, Chapter } from '@matricmate/core';
import { createClient } from '@/lib/supabase/client';
import { AiWorking } from '@/components/ui/AiWorking';
import { Page, PageHead } from '@/components/app/Page';
import { Btn, ItemButton, PillButton, Seg } from '@/components/ui/controls';
import { Card, Check, Item, ScriptText, SectionTitle, Skeleton } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { session } from '@/lib/session';
import { useApp, useLang, useT } from '@/lib/store';

const KIND_LABEL = { mcq: 'tutor.kindMcq', flashcards: 'tutor.kindCards', blanks: 'tutor.kindBlanks', shortq: 'tutor.kindShortq' } as const;

/** Shaped like the builder: header, subject chips, a chapter list, two pickers, the button. */
export function AiTestSkeleton() {
  return (
    <Page width="focus">
      <div className="mb-5">
        <div className="mb-1 flex h-11 items-center">
          <Skeleton className="h-3.5 w-24" />
        </div>
        <Skeleton className="mb-2 h-7 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="mt-6 mb-2 h-4 w-20" />
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-11 w-20 rounded-full" />
        ))}
      </div>
      <Skeleton className="mt-6 mb-2 h-4 w-20" />
      <Card flat className="py-0">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`flex items-center gap-3 py-3.5 ${i < 3 ? 'border-b border-line' : ''}`}>
            <Skeleton className="h-[42px] w-[42px] shrink-0 rounded-[13px]" />
            <Skeleton className="h-3.5 w-3/5" />
          </div>
        ))}
      </Card>
      <Skeleton className="mt-6 mb-2 h-4 w-28" />
      <Skeleton className="h-11 w-full rounded-[13px] sm:w-80" />
      <Skeleton className="mt-6 h-[55px] w-full rounded-[16px]" />
    </Page>
  );
}

/**
 * The AI practice builder. Pick a chapter, a practice type and a size, and
 * the tutor writes a fresh set from that chapter's own text, saved to the
 * student's account so it opens on the phone too.
 */
export function AiTestScreen({ chaptersBySubject }: { chaptersBySubject: Record<string, Chapter[]> }) {
  /** Held while a build is in flight so the wait screen can call it off. */
  const cancel = useRef<AbortController | null>(null);
  const { state, derived } = useApp();
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const router = useRouter();

  const [kind, setKind] = useState<AiSessionKind>('mcq');
  const [subjectId, setSubjectId] = useState(derived.subjects[0] ?? 'phy');
  /* The subject is picked before the store has loaded, from the fallback
     list. When the student's own list arrives, a pick that is not one of
     their subjects moves to their first. A chip they tapped always is. Same
     rule as the MCQ setup. */
  const [seenSubjects, setSeenSubjects] = useState(derived.subjects);
  if (seenSubjects !== derived.subjects) {
    setSeenSubjects(derived.subjects);
    if (derived.subjects.length && !derived.subjects.includes(subjectId)) setSubjectId(derived.subjects[0]);
  }
  const chapters = chaptersBySubject[subjectId] ?? [];
  const [chapterTouched, setChapterTouched] = useState<string | null>(null);
  const fallbackChapter = state.lastChapterId ?? chapters[0]?.id ?? '';
  const chapterId = chapterTouched && chapters.some((c) => c.id === chapterTouched) ? chapterTouched : chapters.some((c) => c.id === fallbackChapter) ? fallbackChapter : (chapters[0]?.id ?? '');
  const [count, setCount] = useState<'5' | '8' | '12'>('8');
  const [busy, setBusy] = useState(false);

  /* MCQ attempts only, and never a nameless topic. Blanks and short questions
     are filed under a chapter's title, which is not an MCQ topic, so a "weak
     topic" test built from them matched no question at all. */
  const weak = useMemo(() => {
    // Also when the syllabus moves (derived.contentReady): weakTopics leaves
    // out answers from chapters outside the one the app is set to.
    void derived.contentReady;
    return weakTopics(state.attempts.filter((a) => (a.mode === 'practice' || a.mode === 'exam') && a.topic)).slice(0, 3);
  }, [state.attempts, derived.contentReady]);

  /* The student's saved sets, mock papers included. The papers were filtered
     out, and this is the only shelf, so a paper the toast said was "in your
     sets" could never be opened again. */
  const [sets, setSets] = useState<AiSessionRow[]>([]);
  useEffect(() => {
    let alive = true;
    fetchAiSessions(createClient()).then((rows) => {
      if (alive) setSets(rows);
    });
    return () => {
      alive = false;
    };
  }, []);

  /** The chapter's own title, which is what attempts are filed under. */
  const titleOf = (id: string) => chaptersBySubject[id.split('-')[0]]?.find((c) => c.id === id)?.title ?? '';

  function openSet(k: AiSessionKind, sessionId: string, items: unknown[], forChapter: string, topic?: string | null) {
    if (k === 'mcq') {
      session.start({
        mode: 'practice',
        label: t('tutor.aiMade'),
        subjectId: forChapter.split('-')[0] || subjectId,
        chapterId: forChapter || null,
        // Filed under the chapter, like a bank set. With no topic every
        // answer went into one nameless weak topic, and the header showed an
        // empty pill.
        // The set's own id goes into every item id, so question 1 of this
        // set is not question 1 of every other set as far as progress goes.
        mcqs: normalizeAiMcqs(items as Parameters<typeof normalizeAiMcqs>[0], forChapter, topic || titleOf(forChapter) || undefined, sessionId),
        aiGenerated: true,
      });
      router.push('/session/mcq');
      return;
    }
    router.push(`/session/${k}?chapter=${forChapter}&ai=${sessionId}`);
  }

  function failNote(reason: AiFail['reason']): string {
    return {
      offline: t('tutor.offline'),
      quota: t('tutor.limitToast'),
      rate: t('tutor.slowDown'),
      plan: t('tutor.planNeeded'),
      refused: t('tutor.refused'),
      syllabus: t('tutor.notInSyllabus'),
      error: t('tutor.errorReply'),
    }[reason];
  }

  async function build() {
    if (busy) return;
    // Say why nothing happened. An empty list used to make the button a
    // silent no-op.
    if (!chapterId) {
      toast(t('tutor.noChapters'));
      return;
    }
    if (!chapters.some((c) => c.id === chapterId)) {
      toast(t('tutor.notInSyllabus'));
      return;
    }
    setBusy(true);
    const controller = new AbortController();
    cancel.current = controller;
    const res = await generateAiSession(
      // The subject's own language, not the student's medium: Urdu and
      // English chapters are written in their own language for everyone.
      { kind, chapterId, count: Number(count), medium: subjectMedium(chapterId, state.onboarding?.board, state.settings.contentMedium) },
      controller.signal,
    );
    cancel.current = null;
    setBusy(false);
    // Stopped on purpose: the toast already said so, and the route finishes
    // and saves either way, so there is nothing to report as a failure.
    if (controller.signal.aborted) return;
    if (!res.ok) {
      toast(failNote(res.reason));
      return;
    }
    /* A reply with no set in it. A refusal used to arrive looking like a
       success: MCQs then threw inside this handler with nothing on screen,
       and the other kinds opened ?ai=undefined, which served the ordinary
       bank set as though it were the new one. */
    if (!res.sessionId || !Array.isArray(res.items) || !res.items.length) {
      toast(t('tutor.refused'));
      return;
    }
    openSet(kind, res.sessionId, res.items, chapterId);
  }

  async function reopen(row: AiSessionRow) {
    if (row.kind === 'paper') {
      router.push(`/tutor/paper?id=${row.id}`);
      return;
    }
    if (row.kind === 'mcq') {
      const s = await fetchAiSession(row.id, createClient());
      if (!s || !Array.isArray(s.items)) {
        toast(t('states.errorTitle'));
        return;
      }
      openSet('mcq', row.id, s.items as unknown[], s.chapterId ?? '', s.topic);
      return;
    }
    openSet(row.kind, row.id, [], row.chapterId ?? '');
  }

  const shelf = sets.slice(0, 5);

  return (
    <Page width="focus">
      {/* Writing a fresh set is twenty seconds of real work, so it gets the
          whole viewport rather than a button that dims. See AiWorking. */}
      <AiWorking
        open={busy}
        title={t('tutor.building')}
        onCancel={() => {
          cancel.current?.abort();
          setBusy(false);
          toast(t('tutor.buildStopped'));
        }}
      />
      <PageHead back="/tutor" backLabel={t('tutor.title')} title={t('tutor.builderTitle')} sub={t('tutor.builderSub')} />

      <SectionTitle>{t('tutor.pickSubject')}</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {derived.subjects.map((sid) => (
          <PillButton key={sid} tone={sid === subjectId ? 'teal' : 'grey'} onClick={() => setSubjectId(sid)}>
            {subjectName(subjectById(sid), lang) || sid}
          </PillButton>
        ))}
      </div>

      <div className="mt-5"><SectionTitle>{t('tutor.pickChapter')}</SectionTitle></div>
      <Card flat className="py-0">
        {chapters.length ? (
          chapters.map((c, i) => (
            <ItemButton
              key={c.id}
              title={`${c.number}. ${chapterName(c, lang)}`}
              icon="book"
              last={i === chapters.length - 1}
              onClick={() => setChapterTouched(c.id)}
              right={<Check on={c.id === chapterId} />}
            />
          ))
        ) : (
          <Item title={t('tutor.noChapters')} icon="book" tone="grey" last />
        )}
      </Card>

      <div className="mt-5"><SectionTitle>{t('tutor.pickKind')}</SectionTitle></div>
      <Seg
        value={kind}
        onChange={setKind}
        label={t('tutor.pickKind')}
        options={(Object.keys(KIND_LABEL) as AiSessionKind[]).map((k) => ({ value: k, label: t(KIND_LABEL[k]) }))}
      />
      <SectionTitle>{t('tutor.pickCount')}</SectionTitle>
      <div className="mt-2">
        <Seg
          value={count}
          onChange={setCount}
          label={t('tutor.pickCount')}
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
        <Btn title={t('tutor.buildIt')} variant="orange" className="w-full" loading={busy} disabled={!chapters.length} onClick={build} />
      </div>

      {weak.length ? (
        <>
          <div className="mt-6"><SectionTitle>{t('tutor.aiTestTitle')}</SectionTitle></div>
          <button
            type="button"
            className="w-full text-start"
            onClick={() => router.push(`/session/exam-intro?ai=1&topics=${encodeURIComponent(weak.map((w) => w.topic).join('|'))}`)}
          >
            <Card border="border-orange" className="transition-colors duration-200 hover:bg-paper">
              <p className="text-[13.5px] font-extrabold text-ink">{t('tutor.aiTestSub')}</p>
              <ScriptText text={weak.map((w) => w.topic).join(' · ')} className="mt-0.5 text-[12.5px] text-ink2" />
            </Card>
          </button>
        </>
      ) : null}

      {shelf.length ? (
        <>
          <div className="mt-6"><SectionTitle>{t('tutor.recentSets')}</SectionTitle></div>
          <Card flat className="py-0">
            {shelf.map((s, i) => (
              <ItemButton
                key={s.id}
                title={s.title}
                sub={`${s.kind === 'paper' ? t('tutor.paperTitle') : t(KIND_LABEL[s.kind])} · ${t('tutor.aiMade')}`}
                icon={s.kind === 'paper' ? 'doc' : 'spark'}
                last={i === shelf.length - 1}
                onClick={() => void reopen(s)}
              />
            ))}
          </Card>
        </>
      ) : null}
    </Page>
  );
}
