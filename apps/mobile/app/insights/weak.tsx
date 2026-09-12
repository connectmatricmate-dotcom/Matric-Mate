import { useMemo } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Btn, Card, Empty, Header, Row, Screen, ScriptText, SectionTitle, Small, Spacer, Text } from '../../src/components/ui';
import { subjectById, subjectName, weakTopics } from '@matricmate/core';
import { useLang, useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, S } from '../../src/theme';

export default function Weak() {
  const { state, contentKey } = useApp();
  const t = useT();
  const { lang } = useLang();
  // contentKey is not read here and has to be listed: weakTopics keeps to the
  // syllabus the chapter index knows, which changes underneath on a switch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rows = useMemo(() => weakTopics(state.attempts), [state.attempts, contentKey]);

  const bySubject = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    (acc[r.subjectId] ||= []).push(r);
    return acc;
  }, {});

  return (
    <Screen>
      <Header title={t('progress.weakTitle')} sub={t('progress.weakSub')} back />

      {rows.length === 0 ? (
        <Empty
          emoji="🔍"
          title={t('progress.weakNoneTitle')}
          sub={t('progress.weakNoneBody')}
          cta={<Btn title={t('tutor.practiceTen')} sm onPress={() => router.push('/session/setup')} />}
        />
      ) : (
        Object.entries(bySubject).map(([sid, list]) => (
          <View key={sid}>
            <SectionTitle>{subjectName(subjectById(sid), lang)}</SectionTitle>
            <View style={{ gap: S.sm }}>
              {list.map((w) => (
                <Card key={`${w.subjectId}|${w.topic}`} flat>
                  <Row>
                    <ScriptText text={w.topic} face="bodyBold" size={14} style={{ flex: 1 }} />
                    <Text style={{ fontFamily: F.display, fontSize: 17, color: w.accuracy < 50 ? C.red : C.orangeDark }}>
                      {w.accuracy}%
                    </Text>
                  </Row>
                  <Small>{t('progress.rightOutOf', { right: w.right, total: w.total })}</Small>
                  {/* A topic from a generated question has no chapter, and
                      /learn/chapter/ with nothing after it is not a page. */}
                  <Row gap={S.sm} style={{ marginTop: S.md }}>
                    {w.chapterId ? (
                      <View style={{ flex: 1 }}>
                        <Btn title={t('progress.studyBtn')} variant="line" sm onPress={() => router.push(`/learn/chapter/${w.chapterId}`)} />
                      </View>
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Btn
                        title={t('progress.practiceTen')}
                        sm
                        onPress={() => router.push(w.chapterId ? `/session/setup?chapter=${w.chapterId}` : '/session/setup')}
                      />
                    </View>
                  </Row>
                </Card>
              ))}
            </View>
          </View>
        ))
      )}
      <Spacer h={S.lg} />
      <Small>{t('progress.weakFootnote')}</Small>
    </Screen>
  );
}
