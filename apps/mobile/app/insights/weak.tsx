import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Btn, Card, Empty, Header, Row, Screen, ScriptText, SectionTitle, Small, Spacer } from '../../src/components/ui';
import { subjectById , weakTopics } from '@matricmate/core';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, F, S } from '../../src/theme';

export default function Weak() {
  const { state } = useApp();
  const t = useT();
  const rows = useMemo(() => weakTopics(state.attempts), [state.attempts]);

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
            <SectionTitle>{subjectById(sid)?.name}</SectionTitle>
            <View style={{ gap: S.sm }}>
              {list.map((w) => (
                <Card key={w.topic} flat>
                  <Row>
                    <ScriptText text={w.topic} face="bodyBold" size={14} style={{ flex: 1 }} />
                    <Text style={{ fontFamily: F.display, fontSize: 17, color: w.accuracy < 50 ? C.red : C.orangeDark }}>
                      {w.accuracy}%
                    </Text>
                  </Row>
                  <Small>{t('progress.rightOutOf', { right: w.right, total: w.total })}</Small>
                  <Row gap={S.sm} style={{ marginTop: S.md }}>
                    <View style={{ flex: 1 }}>
                      <Btn title={t('progress.studyBtn')} variant="line" sm onPress={() => router.push(`/learn/chapter/${w.chapterId}`)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Btn title={t('progress.practiceTen')} sm onPress={() => router.push(`/session/setup?chapter=${w.chapterId}`)} />
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
