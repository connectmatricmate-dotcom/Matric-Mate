import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Body, Btn, Card, Header, Label, Pill, Row, Screen, ScriptText, Small, Spacer, Text } from '../../src/components/ui';
import { useT } from '../../src/i18n';
import { session } from '../../src/store/session';
import { useApp } from '../../src/store/app';
import { C, S, isRTL } from '../../src/theme';
import { Markdown } from '../../src/components/Markdown';

type Filter = 'all' | 'wrong' | 'flagged';

export default function Review() {
  const t = useT();
  const { derived } = useApp();
  const s = session.current;
  const [filter, setFilter] = useState<Filter>('wrong');
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (!s) return [];
    return s.mcqs
      .map((m) => ({ mcq: m, a: s.answers[m.id] }))
      // Unanswered counts as wrong, as it does on the result screen's score:
      // closing a practice set early left those questions out of this list
      // while the score counted them against the student.
      .filter(({ a }) => (filter === 'all' ? true : filter === 'wrong' ? !a?.correct : a?.flagged))
      .sort((x, y) => Number(!!x.a?.correct) - Number(!!y.a?.correct));
  }, [s, filter]);

  const wrongCount = s ? s.mcqs.filter((m) => !s.answers[m.id]?.correct).length : 0;
  const flagCount = s ? Object.values(s.answers).filter((a) => a.flagged).length : 0;

  if (!s) {
    return (
      <Screen>
        <Header title={t('session.reviewTitle')} back />
        <Card flat style={{ alignItems: 'center', gap: S.md }}>
          <Small>{t('session.noSessionBody')}</Small>
          <Btn title={t('session.setUpSession')} sm onPress={() => router.replace('/session/setup')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={t('session.reviewTitle')} sub={s.label} back onBack={() => session.leave()} />

      <Row gap={S.sm} style={{ flexWrap: 'wrap' }}>
        <Pill tone={filter === 'all' ? 'teal' : 'grey'} onPress={() => setFilter('all')}>
          {`${t('session.all')} · ${s.mcqs.length}`}
        </Pill>
        <Pill tone={filter === 'wrong' ? 'red' : 'grey'} onPress={() => setFilter('wrong')}>
          {`${t('session.wrongOnly')} · ${wrongCount}`}
        </Pill>
        <Pill tone={filter === 'flagged' ? 'orange' : 'grey'} onPress={() => setFilter('flagged')}>
          {`${t('session.flaggedOnly')} · ${flagCount}`}
        </Pill>
      </Row>

      <Spacer h={S.md} />
      {rows.length === 0 ? (
        <Card flat style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Text style={{ fontSize: 30 }}>🎉</Text>
          <Body style={{ marginTop: 6, textAlign: 'center' }}>
            {filter === 'wrong' ? t('session.allCorrect') : t('session.nothingFlagged')}
          </Body>
        </Card>
      ) : (
        <View style={{ gap: S.sm }}>
          {rows.map(({ mcq, a }) => {
            const isOpen = open === mcq.id;
            const wrong = a && !a.correct;
            return (
              <Card
                key={mcq.id}
                flat
                /* The accent bar belongs on the side the line starts from, as
                   the reader's definition callout and Markdown's quote block
                   both already do. */
                style={{
                  ...(isRTL()
                    ? { borderRightWidth: 4, borderRightColor: wrong ? C.red : C.green }
                    : { borderLeftWidth: 4, borderLeftColor: wrong ? C.red : C.green }),
                  opacity: wrong ? 1 : 0.85,
                }}
                onPress={() => setOpen(isOpen ? null : mcq.id)}
              >
                <ScriptText text={mcq.q} face="bodyBold" size={13.5} />
                <Row gap={S.sm} style={{ marginTop: S.sm, flexWrap: 'wrap' }}>
                  {a?.chosen != null ? (
                    <Pill tone={wrong ? 'red' : 'green'}>{t('session.yourAnswer', { a: String.fromCharCode(65 + a.chosen) })}</Pill>
                  ) : (
                    <Pill tone="grey">{t('session.notAnswered')}</Pill>
                  )}
                  <Pill tone="green">{t('session.correctAnswer', { a: String.fromCharCode(65 + mcq.answer) })}</Pill>
                  {a?.confidence != null ? (
                    <Pill tone="orange">
                      {[t('session.conf0'), t('session.conf1'), t('session.conf2')][a.confidence]}
                    </Pill>
                  ) : null}
                </Row>
                {isOpen ? (
                  <>
                    <Spacer h={S.sm} />
                    <Label style={{ color: C.teal }}>{t('session.why')}</Label>
                    <View style={{ marginTop: 2 }}><Markdown text={mcq.explanation} size={13.5} /></View>
                    <Spacer h={S.sm} />
                    {/* Wraps, so at a large font the second button drops to a
                        line of its own instead of running out of the card. */}
                    <Row gap={S.sm} style={{ flexWrap: 'wrap' }}>
                      {derived.access.ai ? (
                      <Btn
                        title={t('session.askAi')}
                        variant="line"
                        sm
                        onPress={() => {
                          // In the student's own language: it is sent as their message.
                          const prompt =
                            a?.chosen != null && a.chosen !== mcq.answer
                              ? t('session.askWhyWrong', { mine: mcq.options[a.chosen], right: mcq.options[mcq.answer], q: mcq.q })
                              : t('session.askExplain', { q: mcq.q });
                          router.push(`/tutor/chat?q=${encodeURIComponent(prompt)}${mcq.chapterId ? `&chapter=${mcq.chapterId}` : ''}`);
                        }}
                      />
                      ) : null}
                      {/* A generated question has no chapter to read. */}
                      {mcq.chapterId ? (
                        <Btn
                          title={t('session.readInChapter')}
                          variant="ghost"
                          sm
                          onPress={() => router.push(`/learn/reader/${mcq.chapterId}`)}
                        />
                      ) : null}
                    </Row>
                  </>
                ) : (
                  <Small style={{ marginTop: 6 }}>{t('session.tapForWhy')}</Small>
                )}
              </Card>
            );
          })}
        </View>
      )}
      <Spacer h={S.lg} />
      <Btn
        title={t('common.done')}
        // Back to where the set was started: see session.leave.
        onPress={() => session.leave()}
      />
    </Screen>
  );
}
