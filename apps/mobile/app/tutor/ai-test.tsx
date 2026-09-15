import { useRef, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Btn, Card, Check, Header, Item, Pill, Row, Screen, SectionTitle, Seg, Skeleton, Small, Spacer, useToast } from '../../src/components/ui';
import { AiWorking } from '../../src/components/AiWorking';
import { aiFailureKey } from '../../src/components/aiFailure';
import {
  api,
  chapterById,
  chapterName,
  fetchAiSession,
  fetchAiSessions,
  generateAiSession,
  inSyllabus,
  normalizeAiMcqs,
  subjectById,
  subjectMedium,
  subjectName,
  weakTopics,
} from '@matricmate/core';
import type { AiSessionKind } from '@matricmate/core';
import { useAsync } from '../../src/core/useAsync';
import { useLang, useT } from '../../src/i18n';
import type { StringKey } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { session } from '../../src/store/session';
import { C, S } from '../../src/theme';
import { AiLocked } from '../../src/components/AiLocked';

const KINDS: { value: AiSessionKind; label: StringKey }[] = [
  { value: 'mcq', label: 'tutor.kindMcq' },
  { value: 'flashcards', label: 'tutor.kindCards' },
  { value: 'blanks', label: 'tutor.kindBlanks' },
  { value: 'shortq', label: 'tutor.kindShortq' },
];

/**
 * The AI practice builder. Pick a chapter, a practice type and a size, and
 * the tutor writes a fresh set from that chapter's own text, saved to the
 * student's account so it opens on the website too.
 */
/**
 * AI, so not in Basic: the lock in its place (see AiLocked). Decided before
 * the screen's own hooks run, so it never starts a request it cannot make.
 */
export default function AiBuilderGate() {
  const { derived } = useApp();
  if (derived.access.active && !derived.access.ai) return <AiLocked titleKey="tutor.builderTitle" />;
  return <AiBuilder />;
}

function AiBuilder() {
  const { state, derived, contentKey, contentLoading } = useApp();
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const board = state.onboarding?.board ?? 'fbise';

  const [kind, setKind] = useState<AiSessionKind>('mcq');
  const [subjectId, setSubjectId] = useState(derived.plan[0]?.subjectId ?? derived.subjects[0] ?? 'phy');
  /**
   * The subject's chapters, read for this screen.
   *
   * This was a memo over the synchronous index that never looked again, so a
   * Class 10 or Punjab student who opened it before the index had loaded got
   * an empty list and a "Make my set" button that silently did nothing.
   */
  const list = useAsync(() => api.getChapters(subjectId), [subjectId, contentKey]);
  const chapters = list.data ?? [];
  const [chapterTouched, setChapterTouched] = useState<string | null>(null);
  const chapterId = chapterTouched ?? state.lastChapterId ?? chapters[0]?.id ?? '';
  const chapterInSubject = chapters.some((c) => c.id === chapterId) ? chapterId : (chapters[0]?.id ?? '');
  const [count, setCount] = useState<'5' | '8' | '12'>('8');
  const [busy, setBusy] = useState(false);
  /** Held while a build is in flight so the wait screen can call it off. */
  const cancel = useRef<AbortController | null>(null);
  /** Moved to read the shelf again, after a wait that ran out. */
  const [shelfKey, setShelfKey] = useState(0);

  const weak = weakTopics(state.attempts).slice(0, 3);

  async function build() {
    if (busy) return;
    // Said, not swallowed: the button used to return without a word.
    if (!chapterInSubject) {
      toast(t('tutor.noChapters'));
      return;
    }
    if (!inSyllabus(chapterInSubject, state.onboarding?.classLevel ?? 9, board)) {
      toast(t('tutor.notInSyllabus'));
      return;
    }
    setBusy(true);
    const controller = new AbortController();
    cancel.current = controller;
    const res = await generateAiSession(
      {
        kind,
        chapterId: chapterInSubject,
        count: Number(count),
        // The subject's own language: English is written in English and Urdu
        // in Urdu whatever the student reads in.
        medium: subjectMedium(chapterInSubject, board, state.settings.contentMedium),
      },
      controller.signal,
    );
    cancel.current = null;
    setBusy(false);
    // Stopped on purpose: the toast already said so, and the route finishes
    // and saves either way, so there is nothing to report as a failure.
    if (controller.signal.aborted) return;
    if (!res.ok) {
      // The wait running out is not the student's Stop, nor a lost
      // connection: the server finishes and saves the set on the shelf below.
      toast(res.timedOut ? t('tutor.buildTimedOut') : t(aiFailureKey(res.reason)));
      if (res.timedOut) setShelfKey((n) => n + 1);
      return;
    }
    openSet(kind, res.sessionId, res.items, chapterInSubject);
  }

  /** Route a generated set into the right session screen. */
  function openSet(k: AiSessionKind, sessionId: string, items: unknown[], forChapter: string) {
    if (k === 'mcq') {
      session.start({
        mode: 'practice',
        label: t('tutor.aiMade'),
        subjectId: forChapter.split('-')[0],
        chapterId: forChapter,
        // The set's id in every question's id, so no two sets share one, and
        // the chapter's name as the topic, so a wrong answer becomes a named
        // weak topic rather than a blank one.
        mcqs: normalizeAiMcqs(
          items as Parameters<typeof normalizeAiMcqs>[0],
          forChapter,
          chapterName(chapterById(forChapter), subjectMedium(forChapter, board, state.settings.contentMedium)) || undefined,
          sessionId,
        ),
        aiGenerated: true,
      });
      router.replace('/session/mcq');
      return;
    }
    const suffix = `chapter=${forChapter}&ai=${sessionId}`;
    if (k === 'flashcards') router.replace(`/session/flashcards?${suffix}`);
    else if (k === 'blanks') router.replace(`/session/blanks?${suffix}`);
    else router.replace(`/session/shortq?${suffix}`);
  }

  /** Reopen a saved set from the shelf. MCQ sets rebuild the session state. */
  async function reopen(id: string, k: string, forChapter: string | null) {
    if (k === 'paper') return;
    if (k === 'mcq') {
      const s = await fetchAiSession(id);
      if (!s) {
        toast(t('states.errorTitle'));
        return;
      }
      openSet('mcq', id, s.items as unknown[], s.chapterId ?? forChapter ?? '');
      return;
    }
    openSet(k as AiSessionKind, id, [], forChapter ?? '');
  }

  return (
    <Screen
      footer={
        <Btn
          title={t('tutor.buildIt')}
          variant="orange"
          icon="spark"
          loading={busy}
          disabled={!list.loading && !chapterInSubject}
          onPress={build}
        />
      }
    >
      {/* Writing a fresh set is twenty seconds of real work, so it gets the
          whole screen rather than a button that dims. See AiWorking. */}
      <AiWorking
        visible={busy}
        title={t('tutor.building')}
        onCancel={() => {
          cancel.current?.abort();
          setBusy(false);
          toast(t('tutor.buildStopped'));
        }}
      />
      <Header title={t('tutor.builderTitle')} sub={t('tutor.builderSub')} back />

      <SectionTitle>{t('tutor.pickSubject')}</SectionTitle>
      <Row gap={S.sm} style={{ flexWrap: 'wrap' }}>
        {derived.subjects.map((sid) => (
          <Pill key={sid} tone={sid === subjectId ? 'teal' : 'grey'} selected={sid === subjectId} onPress={() => setSubjectId(sid)}>
            {subjectName(subjectById(sid), lang) || sid}
          </Pill>
        ))}
      </Row>

      <SectionTitle>{t('tutor.pickChapter')}</SectionTitle>
      {(list.loading || contentLoading) && !chapters.length ? (
        <View style={{ gap: S.sm }}>
          <Skeleton h={52} />
          <Skeleton h={52} />
          <Skeleton h={52} />
        </View>
      ) : !chapters.length ? (
        <Card flat>
          <Small>{t('tutor.noChapters')}</Small>
        </Card>
      ) : (
        <Card flat style={{ paddingVertical: 0 }}>
          {chapters.map((c, i) => (
            <Item
              key={c.id}
              title={`${c.number}. ${chapterName(c, lang)}`}
              icon="book"
              last={i === chapters.length - 1}
              onPress={() => setChapterTouched(c.id)}
              checked={c.id === chapterInSubject}
              right={<Check on={c.id === chapterInSubject} />}
            />
          ))}
        </Card>
      )}

      <SectionTitle>{t('tutor.pickKind')}</SectionTitle>
      <Seg
        value={kind}
        onChange={setKind}
        options={KINDS.map((k) => ({ value: k.value, label: t(k.label) }))}
      />
      <SectionTitle>{t('tutor.pickCount')}</SectionTitle>
      <Seg
        value={count}
        onChange={setCount}
        options={[
          { value: '5', label: '5' },
          { value: '8', label: '8' },
          { value: '12', label: '12' },
        ]}
      />

      {/* The allowance comes from the account, not from a literal: 50 was
          only ever the premium number, and an account with none at all was
          told it was spending out of a bucket it does not have. */}
      {derived.aiLimit > 0 ? (
        <>
          <Spacer h={S.md} />
          <Card flat tint={C.tealTint}>
            <Small>{t('tutor.costNote', { n: 2, limit: derived.aiLimit })}</Small>
          </Card>
        </>
      ) : null}

      {weak.length ? (
        <>
          <SectionTitle>{t('tutor.aiTestTitle')}</SectionTitle>
          <Card
            onPress={() =>
              router.push(
                // The topics' own chapters ride along, so the test and its
                // padding stay inside them instead of drawing from anywhere.
                `/session/exam-intro?ai=1&topics=${encodeURIComponent(weak.map((w) => w.topic).join('|'))}&chapters=${encodeURIComponent(
                  weak.map((w) => w.chapterId).filter(Boolean).join('|'),
                )}&count=15&difficulty=board`,
              )
            }
            border={C.orange}
            style={{ gap: 4 }}
          >
            <Small style={{ color: C.ink }}>{t('tutor.aiTestSub')}</Small>
            <Small style={{ fontSize: 11.5 }}>{weak.map((w) => w.topic).join(' · ')}</Small>
          </Card>
        </>
      ) : null}

      <RecentSets onOpen={reopen} refreshKey={shelfKey} />
    </Screen>
  );
}

/** The shelf of saved AI sets, so a set built yesterday is one tap away. */
function RecentSets({ onOpen, refreshKey }: { onOpen: (id: string, kind: string, chapterId: string | null) => void; refreshKey: number }) {
  const t = useT();
  const { state } = useApp();
  const { data: sets } = useAsync(
    () => fetchAiSessions().then((rows) => rows.filter((r) => r.kind !== 'paper')),
    [state.user?.id ?? '', refreshKey],
  );

  if (!sets?.length) return null;
  return (
    <>
      <SectionTitle>{t('tutor.recentSets')}</SectionTitle>
      <Card flat style={{ paddingVertical: 0 }}>
        {sets.slice(0, 5).map((s, i) => (
          <Item
            key={s.id}
            title={s.title}
            sub={`${t(`tutor.kind${s.kind === 'mcq' ? 'Mcq' : s.kind === 'flashcards' ? 'Cards' : s.kind === 'blanks' ? 'Blanks' : 'Shortq'}` as StringKey)} · ${t('tutor.aiMade')}`}
            icon="spark"
            last={i === Math.min(4, sets.length - 1)}
            onPress={() => onOpen(s.id, s.kind, s.chapterId)}
          />
        ))}
      </Card>
    </>
  );
}
