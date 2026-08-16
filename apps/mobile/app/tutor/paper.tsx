import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Btn, Card, ErrorState, Header, Label, Pill, Row, Screen, ScriptText, SectionTitle, Skeleton, Small, Spacer, useToast } from '../../src/components/ui';
import { checkAnswerLive, fetchAiSession, generateMockPaper, subjectById } from '@matricmate/core';
import type { AiCheckVerdict, AiPaperItems, ShortQ } from '@matricmate/core';
import { useAsync } from '../../src/core/useAsync';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { session } from '../../src/store/session';
import { C, F, S, isWeb } from '../../src/theme';
import { Markdown } from '../../src/components/Markdown';

/**
 * The board mock paper. Without an id: pick a subject and have one set.
 * With ?id=: the paper itself, in board shape: Section A runs as a timed
 * exam, Sections B and C are written right here and marked by the AI
 * examiner against each question's marking points.
 */
export default function MockPaper() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { state, derived } = useApp();
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [subjectId, setSubjectId] = useState(derived.subjects[0] ?? 'phy');

  const paper = useAsync(async () => (id ? fetchAiSession(id) : null), [id ?? '']);

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
    router.setParams({ id: res.sessionId });
  }

  if (!id) {
    return (
      <Screen footer={<Btn title={busy ? t('tutor.paperBuilding') : t('tutor.buildIt')} variant="orange" icon="spark" loading={busy} onPress={build} />}>
        <Header title={t('tutor.paperTitle')} sub={t('tutor.paperSub')} back />
        <SectionTitle>{t('tutor.pickSubject')}</SectionTitle>
        <Row gap={S.sm} style={{ flexWrap: 'wrap' }}>
          {derived.subjects.map((sid) => (
            <Pill key={sid} tone={sid === subjectId ? 'teal' : 'grey'} onPress={() => setSubjectId(sid)}>
              {subjectById(sid)?.name ?? sid}
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
  const items = paper.data?.items as AiPaperItems | undefined;
  if (!paper.data || !items) {
    return (
      <Screen>
        <Header title={t('tutor.paperTitle')} back />
        <Spacer h={S.lg} />
        <ErrorState title={t('states.errorTitle')} sub={t('states.errorBody')} retry={t('common.retry')} onRetry={paper.reload} />
      </Screen>
    );
  }

  const startSectionA = () => {
    session.start({
      mode: 'exam',
      label: paper.data!.title,
      subjectId: paper.data!.subjectId ?? subjectId,
      chapterId: null,
      mcqs: items.mcqs,
      durationSec: items.mcqs.length * 90,
      aiGenerated: true,
    });
    router.push('/session/exam');
  };

  return (
    <Screen>
      <Header title={paper.data.title} sub={t('tutor.aiMade')} back />

      <Card border={C.orange} style={{ gap: 6 }}>
        <Label style={{ color: C.orangeDark }}>{t('tutor.paperSectionA')}</Label>
        <Small>{t('session.examRules', { n: items.mcqs.length, min: Math.round((items.mcqs.length * 90) / 60) })}</Small>
        <Spacer h={2} />
        <Btn title={t('tutor.paperStart')} variant="orange" sm onPress={startSectionA} />
      </Card>

      <SectionTitle>{t('tutor.paperSectionB')}</SectionTitle>
      {items.shortQs.map((q, n) => (
        <PaperQuestion key={q.id} n={n + 1} q={q} medium={state.settings.contentMedium} />
      ))}

      <SectionTitle>{t('tutor.paperSectionC')}</SectionTitle>
      {items.longQs.map((q, n) => (
        <PaperQuestion key={q.id} n={n + 1} q={q} medium={state.settings.contentMedium} />
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
      toast(t('tutor.errorReply'));
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
                { fontFamily: F.body, fontSize: 14, lineHeight: 22, color: C.ink, minHeight: 80, textAlignVertical: 'top' },
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
        <Small>{t('session.tapForWhy')}</Small>
      )}
    </Card>
  );
}
