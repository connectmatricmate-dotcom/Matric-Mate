import { useRef, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Btn, Card, Empty, ErrorState, Header, Label, Pill, Row, Screen, ScriptText, SectionTitle, Skeleton, Small, Spacer, Text, TextInput, useToast } from '../../src/components/ui';
import { AiWorking } from '../../src/components/AiWorking';
import { aiFailureKey } from '../../src/components/aiFailure';
import { checkAnswerLive, generateMockPaper, isUrduScript, readAiSession, subjectById, subjectMedium, subjectName } from '@matricmate/core';
import type { AiCheckVerdict, AiPaperItems, ShortQ } from '@matricmate/core';
import { useAsync } from '../../src/core/useAsync';
import { useLang, useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { session } from '../../src/store/session';
import { C, F, S, isRTL, isWeb, textStart } from '../../src/theme';
import { Markdown } from '../../src/components/Markdown';
import { AiLocked } from '../../src/components/AiLocked';

/**
 * The board mock paper. Without an id: pick a subject and have one set.
 * With ?id=: the paper itself, in board shape: Section A runs as a timed
 * exam, Sections B and C are written right here and marked by the AI
 * examiner against each question's marking points.
 */
/**
 * AI, so not in Basic: the lock in its place (see AiLocked). Decided before
 * the screen's own hooks run, so it never starts a request it cannot make.
 */
export default function MockPaperGate() {
  const { derived } = useApp();
  if (derived.access.active && !derived.access.ai) return <AiLocked titleKey="tutor.paperTitle" />;
  return <MockPaper />;
}

function MockPaper() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, derived } = useApp();
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  /** Held while a build is in flight so the wait screen can call it off. */
  const cancel = useRef<AbortController | null>(null);
  const [subjectId, setSubjectId] = useState(derived.plan[0]?.subjectId ?? derived.subjects[0] ?? 'phy');
  const board = state.onboarding?.board ?? 'fbise';

  /* A paper that is gone and a read that did not come back used to wear one
     face, with a Retry that could only ever help one of them. */
  const paper = useAsync(async () => (id ? readAiSession(id) : null), [id ?? '']);

  async function build() {
    if (busy) return;
    setBusy(true);
    const controller = new AbortController();
    cancel.current = controller;
    // Set in the subject's own language: an Urdu or Punjab Islamiyat paper in
    // Urdu, an English paper in English, whatever the student reads in.
    const res = await generateMockPaper(
      { subjectId, medium: subjectMedium(subjectId, board, state.settings.contentMedium) },
      controller.signal,
    );
    cancel.current = null;
    setBusy(false);
    // Stopped on purpose: see the note in the AI builder.
    if (controller.signal.aborted) return;
    if (!res.ok) {
      toast(t(aiFailureKey(res.reason)));
      return;
    }
    router.setParams({ id: res.sessionId });
  }

  if (!id) {
    return (
      <Screen footer={<Btn title={t('tutor.buildIt')} variant="orange" icon="spark" loading={busy} onPress={build} />}>
        {/* Half a minute of real work, so it gets the whole screen rather
            than a button that dims. See components/AiWorking. */}
        <AiWorking
          visible={busy}
          title={t('tutor.paperBuilding')}
          onCancel={() => {
            cancel.current?.abort();
            setBusy(false);
            toast(t('tutor.buildStopped'));
          }}
        />
        <Header title={t('tutor.paperTitle')} sub={t(state.onboarding?.board === 'punjab' ? 'tutor.paperSubPunjab' : 'tutor.paperSub')} back />
        <SectionTitle>{t('tutor.pickSubject')}</SectionTitle>
        <Row gap={S.sm} style={{ flexWrap: 'wrap' }}>
          {derived.subjects.map((sid) => (
            <Pill key={sid} tone={sid === subjectId ? 'teal' : 'grey'} onPress={() => setSubjectId(sid)}>
              {subjectName(subjectById(sid), lang) || sid}
            </Pill>
          ))}
        </Row>
        {/* The allowance comes from the account, not from a literal: 50 was
            only ever the premium number, and an account with none at all was
            told it was spending out of a bucket it does not have. */}
        {derived.aiLimit > 0 ? (
          <>
            <Spacer h={S.md} />
            <Card flat tint={C.tealTint}>
              <Small>{t('tutor.costNote', { n: 3, limit: derived.aiLimit })}</Small>
            </Card>
          </>
        ) : null}
      </Screen>
    );
  }

  if (paper.loading) {
    return (
      <Screen>
        <Header title={t('tutor.paperTitle')} back />
        <Skeleton h={120} />
      </Screen>
    );
  }
  const read = paper.data;
  const row = read?.ok ? read.row : null;
  const items = row?.items as AiPaperItems | undefined;
  if (!row || !items) {
    // Gone is gone: the way on is a fresh paper, not a retry.
    const gone = !!read && !read.ok && read.reason === 'missing';
    return (
      <Screen>
        <Header title={t('tutor.paperTitle')} back />
        <Spacer h={S.lg} />
        {gone ? (
          <Empty
            emoji="📄"
            title={t('tutor.paperGoneTitle')}
            sub={t('tutor.paperGoneBody')}
            cta={<Btn title={t('tutor.buildIt')} sm onPress={() => router.setParams({ id: undefined })} />}
          />
        ) : (
          <ErrorState
            title={t('tutor.paperLoadFailed')}
            sub={t('tutor.paperLoadFailedBody')}
            retry={t('common.retry')}
            onRetry={paper.reload}
          />
        )}
      </Screen>
    );
  }
  // Written answers are marked in the paper's own language: see subjectMedium.
  const paperMedium = subjectMedium(row.subjectId ?? subjectId, board, state.settings.contentMedium);

  const startSectionA = () => {
    session.start({
      mode: 'exam',
      label: row.title,
      subjectId: row.subjectId ?? subjectId,
      chapterId: null,
      mcqs: items.mcqs,
      durationSec: items.mcqs.length * 90,
      aiGenerated: true,
    });
    router.push('/session/exam');
  };

  return (
    <Screen>
      <Header title={row.title} sub={t('tutor.aiMade')} back />

      <Card border={C.orange} style={{ gap: 6 }}>
        <Label style={{ color: C.orangeDark }}>{t('tutor.paperSectionA')}</Label>
        <Small>{t('session.examRules', { n: items.mcqs.length, min: Math.round((items.mcqs.length * 90) / 60) })}</Small>
        <Spacer h={2} />
        <Btn title={t('tutor.paperStart')} variant="orange" sm onPress={startSectionA} />
      </Card>

      <SectionTitle>{t('tutor.paperSectionB')}</SectionTitle>
      {items.shortQs.map((q, n) => (
        <PaperQuestion key={q.id} n={n + 1} q={q} medium={paperMedium} />
      ))}

      <SectionTitle>{t('tutor.paperSectionC')}</SectionTitle>
      {items.longQs.map((q, n) => (
        <PaperQuestion key={q.id} n={n + 1} q={q} medium={paperMedium} />
      ))}
      <Spacer h={S.lg} />
    </Screen>
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
      // What actually happened: "not counted, try again" is wrong for a spent
      // allowance or a missing plan, where trying again cannot work.
      toast(t(aiFailureKey(res.reason)));
      return;
    }
    setVerdict(res.verdict);
    setRevealed(true);
  }

  return (
    <Card onPress={open ? undefined : () => setOpen(true)} style={{ marginBottom: S.sm, gap: 8 }}>
      <Row gap={S.sm}>
        <Label style={{ color: C.teal }}>Q{n}</Label>
        <Pill tone="grey">{t('session.marks', { n: q.marks })}</Pill>
      </Row>
      <ScriptText text={q.q} face="bodyBold" size={14.5} />
      {open ? (
        <>
          <View style={{ backgroundColor: C.paper, borderWidth: 1.5, borderColor: C.line, borderRadius: 12, padding: 12 }}>
            <TextInput
              value={written}
              onChangeText={setWritten}
              placeholder={t('tutor.checkPlaceholder')}
              placeholderTextColor={C.ink3}
              multiline
              style={[
                // A written answer reads the way the rest of the screen reads.
                { fontFamily: F.body, fontSize: 14, lineHeight: 22, color: C.ink, minHeight: 80, textAlignVertical: 'top', textAlign: textStart() },
                // Typed in Urdu, it gets Nastaliq and its leading: at 22 the
                // lines of an Urdu answer overlapped and were cropped.
                isRTL() || isUrduScript(written) ? { fontFamily: F.urdu, lineHeight: 30 } : null,
                isWeb && ({ outlineStyle: 'none' } as object),
              ]}
            />
          </View>
          <Row gap={S.sm}>
            <View style={{ flex: 1 }}>
              <Btn
                title={checking ? t('tutor.checkBusy') : t('tutor.checkTitle')}
                variant="orange"
                sm
                loading={checking}
                disabled={!written.trim()}
                onPress={checkMine}
              />
            </View>
            {!revealed ? (
              <View style={{ flex: 1 }}>
                <Btn title={t('session.revealAnswer')} variant="line" sm onPress={() => setRevealed(true)} />
              </View>
            ) : null}
          </Row>
          {verdict ? (
            <Card flat tint={verdict.score >= verdict.maxMarks ? C.greenTint : C.orangeTint} border={verdict.score >= verdict.maxMarks ? C.green : C.orange}>
              <Text style={{ fontFamily: F.display, fontSize: 17, color: C.ink }}>
                {t('tutor.checkScore', { a: verdict.score, b: verdict.maxMarks })}
              </Text>
              <View style={{ marginTop: 4 }}><Markdown text={verdict.feedback} size={13.5} /></View>
            </Card>
          ) : null}
          {revealed ? (
            <Card flat tint={C.greenTint} border={C.green}>
              <Label style={{ color: C.green }}>{t('session.modelAnswer')}</Label>
              <View style={{ marginTop: 4 }}><Markdown text={q.answer} size={14} /></View>
              {q.points.length ? (
                <>
                  <Spacer h={S.sm} />
                  <Label style={{ color: C.ink2 }}>{t('session.markingPoints')}</Label>
                  <View style={{ gap: 4, marginTop: 4 }}>
                    {/* The bullet rides inside the string so an Urdu point
                        keeps it on the right, as the short-answer screen does. */}
                    {q.points.map((p, i) => (
                      <ScriptText key={i} text={`• ${p}`} size={13} color={C.ink2} />
                    ))}
                  </View>
                </>
              ) : null}
            </Card>
          ) : null}
        </>
      ) : (
        // Tapping opens the answer box, so the card says that, not
        // "Tap to see the explanation", which is what the review screen does.
        <Small>{t('tutor.paperTapToAnswer')}</Small>
      )}
    </Card>
  );
}
