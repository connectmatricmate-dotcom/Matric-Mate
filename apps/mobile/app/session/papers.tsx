import { Linking, View } from 'react-native';
import { fbisePastPapersByYear } from '@matricmate/core';
import { Btn, Card, Empty, Header, Item, Screen, SectionTitle, Small, Spacer, useToast } from '../../src/components/ui';
import { useT } from '../../src/i18n';
import { S } from '../../src/theme';

export default function Papers() {
  const t = useT();
  const toast = useToast();
  const groups = fbisePastPapersByYear();
  const hasPapers = groups.some((g) => g.papers.length > 0);

  async function openPaper(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      toast(t('common.openLinkError'));
    }
  }

  return (
    <Screen>
      <Header title={t('session.papersTitle')} sub={t('session.papersSub')} back />

      {hasPapers ? (
        groups.map(({ year, papers }) => (
          <View key={year}>
            <SectionTitle>{t('session.papersYearHeading', { year })}</SectionTitle>
            <Card flat style={{ paddingVertical: 0 }}>
              {papers.map((p, i) => (
                <Item
                  key={p.file}
                  icon="doc"
                  title={p.label}
                  sub={t(p.selfHosted ? 'session.papersSelfHostedNote' : 'session.papersHostedNote')}
                  last={i === papers.length - 1}
                  right={<Btn title={t('session.viewPaper')} variant="line" sm onPress={() => openPaper(p.url)} />}
                />
              ))}
            </Card>
          </View>
        ))
      ) : (
        <Empty emoji="📄" title={t('session.papersEmptyTitle')} sub={t('session.papersEmptyBody')} />
      )}

      <Spacer h={S.md} />
      <Small>{t('session.papersFootnote')}</Small>
    </Screen>
  );
}
