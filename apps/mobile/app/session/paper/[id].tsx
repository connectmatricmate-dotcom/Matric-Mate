import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Btn, Card, Header, Label, Pill, Screen, Small, Spacer, Ur } from '../../../src/components/ui';
import { PAPER_CONTENT, PAST_PAPERS, paperContent, subjectById } from '@matricmate/core';
import { useT } from '../../../src/i18n';
import { C, F, S } from '../../../src/theme';

export default function PaperViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const paper = PAST_PAPERS.find((p) => p.id === id);
  const sections = paperContent(id);
  const isReal = !!PAPER_CONTENT[id];

  return (
    <Screen
      footer={
        <Btn
          title={t('session.practiceThisPaper')}
          onPress={() =>
            router.replace(`/session/exam-intro?subject=${paper?.subjectId ?? 'phy'}&paper=${paper?.year ?? 2025}`)
          }
        />
      }
    >
      <Header
        title={paper ? `FBISE ${paper.year} · ${paper.session}` : ''}
        sub={paper ? subjectById(paper.subjectId)?.name : ' '}
        back
        right={isReal ? <Pill tone="green">{t('session.fullPaper')}</Pill> : undefined}
      />

      <Card>
        {/* Paper masthead, laid out the way the printed board paper is */}
        <Text style={{ fontFamily: F.display, fontSize: 15, color: C.ink, textAlign: 'center' }}>
          FEDERAL BOARD SSC-I EXAMINATION
        </Text>
        <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: C.ink, textAlign: 'center', marginTop: 2 }}>
          {subjectById(paper?.subjectId ?? 'phy')?.name?.toUpperCase()}, {paper?.year}
        </Text>
        <Label style={{ textAlign: 'center', marginTop: 4 }}>
          {t('session.paperMeta', {
            marks: paper?.marks ?? 65,
            h: Math.floor((paper?.minutes ?? 150) / 60),
            m: (paper?.minutes ?? 150) % 60,
          })}
        </Label>

        <View style={{ height: 1, backgroundColor: C.line, marginVertical: S.md }} />

        {sections.map((sec) => (
          <View key={sec.heading} style={{ marginBottom: S.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: 6 }}>
              {sec.urdu ? (
                <Ur size={15} style={{ flex: 1 }}>
                  {sec.heading}
                </Ur>
              ) : (
                <Text style={{ flex: 1, fontFamily: F.bodyBold, fontSize: 13.5, color: C.ink }}>{sec.heading}</Text>
              )}
              {sec.marks ? <Pill tone="grey">{sec.marks}</Pill> : null}
            </View>
            <View style={{ gap: 7 }}>
              {sec.lines.map((line: string, i: number) =>
                sec.urdu ? (
                  <Ur key={i} size={14.5} style={{ color: i === 0 ? C.ink : C.ink2 }}>
                    {line}
                  </Ur>
                ) : (
                  <Text
                    key={i}
                    style={{
                      fontFamily: i === 0 ? F.bodyBold : F.body,
                      fontSize: 13,
                      lineHeight: 21,
                      color: i === 0 ? C.ink : C.ink2,
                    }}
                  >
                    {line}
                  </Text>
                )
              )}
            </View>
          </View>
        ))}
      </Card>

      <Spacer h={S.md} />
      <Small>{isReal ? t('session.realPaperNote') : t('session.paperViewerNote')}</Small>
    </Screen>
  );
}
