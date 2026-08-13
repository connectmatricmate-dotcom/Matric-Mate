import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Btn, Card, Check, Header, Item, Pill, Row, Screen, SectionTitle, Seg, Small, Spacer, useToast } from '../../src/components/ui';
import {
  chaptersFor,
  fetchAiSession,
  fetchAiSessions,
  generateAiSession,
  normalizeAiMcqs,
  subjectById,
  weakTopics,
} from '@matricmate/core';
import type { AiSessionKind } from '@matricmate/core';
import { useAsync } from '../../src/core/useAsync';
import { useT } from '../../src/i18n';
import type { StringKey } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { session } from '../../src/store/session';
import { C, S } from '../../src/theme';

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
export default function AiBuilder() {
  const { state, derived } = useApp();
  const t = useT();
  const toast = useToast();

  const [kind, setKind] = useState<AiSessionKind>('mcq');
  const [subjectId, setSubjectId] = useState(derived.subjects[0] ?? 'phy');
  const chapters = useMemo(() => chaptersFor(subjectId), [subjectId]);
  const [chapterTouched, setChapterTouched] = useState<string | null>(null);
  const chapterId = chapterTouched ?? state.lastChapterId ?? chapters[0]?.id ?? '';
  const chapterInSubject = chapters.some((c) => c.id === chapterId) ? chapterId : (chapters[0]?.id ?? '');
  const [count, setCount] = useState<'5' | '8' | '12'>('8');
  const [busy, setBusy] = useState(false);

  const weak = useMemo(() => weakTopics(state.attempts).slice(0, 3), [state.attempts]);

  async function build() {
    if (!chapterInSubject || busy) return;
    setBusy(true);
    const res = await generateAiSession({
      kind,
      chapterId: chapterInSubject,
      count: Number(count),
      medium: state.settings.contentMedium,
    });
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
        mcqs: normalizeAiMcqs(items as Parameters<typeof normalizeAiMcqs>[0], forChapter),
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
    <Screen footer={<Btn title={busy ? t('tutor.building') : t('tutor.buildIt')} variant="orange" icon="spark" loading={busy} onPress={build} />}>
      <Header title={t('tutor.builderTitle')} sub={t('tutor.builderSub')} back />

      <SectionTitle>{t('tutor.pickSubject')}</SectionTitle>
      <Row gap={S.sm} style={{ flexWrap: 'wrap' }}>
        {derived.subjects.map((sid) => (
          <Pill key={sid} tone={sid === subjectId ? 'teal' : 'grey'} onPress={() => setSubjectId(sid)}>
            {subjectById(sid)?.name ?? sid}
          </Pill>
        ))}
      </Row>

      <SectionTitle>{t('tutor.pickChapter')}</SectionTitle>
      <Card flat style={{ paddingVertical: 0 }}>
        {chapters.map((c, i) => (
          <Item
            key={c.id}
            title={`${c.number}. ${c.title}`}
            icon="book"
            last={i === chapters.length - 1}
            onPress={() => setChapterTouched(c.id)}
            right={<Check on={c.id === chapterInSubject} />}
          />
        ))}
      </Card>

      <SectionTitle>{t('common.questions')}</SectionTitle>
      <Seg
        value={kind}
        onChange={setKind}
        options={KINDS.map((k) => ({ value: k.value, label: t(k.label) }))}
      />
      <Spacer h={S.sm} />
      <Seg
        value={count}
        onChange={setCount}
        options={[
          { value: '5', label: '5' },
          { value: '8', label: '8' },
          { value: '12', label: '12' },
        ]}
      />

      <Spacer h={S.md} />
      <Card flat tint={C.tealTint}>
        <Small>{t('tutor.costNote', { n: 2, limit: 50 })}</Small>
      </Card>

      {weak.length ? (
        <>
          <SectionTitle>{t('tutor.aiTestTitle')}</SectionTitle>
          <Card
            onPress={() =>
              router.push(
                `/session/exam-intro?ai=1&topics=${encodeURIComponent(weak.map((w) => w.topic).join('|'))}&count=15&difficulty=board`,
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

      <RecentSets onOpen={reopen} />
    </Screen>
  );
}

/** The shelf of saved AI sets, so a set built yesterday is one tap away. */
function RecentSets({ onOpen }: { onOpen: (id: string, kind: string, chapterId: string | null) => void }) {
  const t = useT();
  const { data: sets } = useAsync(() => fetchAiSessions().then((rows) => rows.filter((r) => r.kind !== 'paper')), []);

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
