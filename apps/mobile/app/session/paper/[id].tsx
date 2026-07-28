import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Btn, Card, Header, Label, Screen, Small, Spacer } from '../../../src/components/ui';
import { PAPER_BODY, PAST_PAPERS, subjectById } from '../../../src/core/content';
import { useT } from '../../../src/i18n';
import { C, F, S } from '../../../src/theme';

export default function PaperViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const paper = PAST_PAPERS.find((p) => p.id === id);

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
      />

      <Card>
        <Text style={{ fontFamily: F.display, fontSize: 15, color: C.ink, textAlign: 'center' }}>
          FEDERAL BOARD — SSC-I {subjectById(paper?.subjectId ?? 'phy')?.name?.toUpperCase()}
        </Text>
        <Label style={{ textAlign: 'center', marginTop: 2 }}>
          {t('session.paperMeta', {
            marks: paper?.marks ?? 65,
            h: Math.floor((paper?.minutes ?? 150) / 60),
            m: (paper?.minutes ?? 150) % 60,
          })}
        </Label>
        <View style={{ height: 1, backgroundColor: C.line, marginVertical: S.md }} />
        {PAPER_BODY.map((sec) => (
          <View key={sec.heading} style={{ marginBottom: S.md }}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 13.5, color: C.ink }}>{sec.heading}</Text>
            <View style={{ gap: 4, marginTop: 4 }}>
              {sec.lines.map((l, i) => (
                <Text key={i} style={{ fontFamily: F.body, fontSize: 13, lineHeight: 21, color: i === 0 ? C.ink : C.ink2 }}>
                  {l}
                </Text>
              ))}
            </View>
          </View>
        ))}
      </Card>

      <Spacer h={S.md} />
      <Small>{t('session.paperViewerNote')}</Small>
    </Screen>
  );
}
