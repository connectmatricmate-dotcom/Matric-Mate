import { Linking, View } from 'react-native';
import { boardName, pastPapersByYear } from '@matricmate/core';
import { Btn, Card, Empty, Header, Item, Screen, SectionTitle, Small, Spacer, useToast } from '../../src/components/ui';
import { useLang, useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { S } from '../../src/theme';

export default function Papers() {
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const { state } = useApp();
  // The student's own class and board. Showing a Class 10 student the SSC-I
  // papers as "your board's papers" was the sort of thing they would spot
  // instantly, and a Punjab student FBISE's even more so.
  const board = state.onboarding?.board ?? 'fbise';
  const punjab = board === 'punjab';
  const groups = pastPapersByYear(board, state.onboarding?.classLevel ?? 9);
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
      <Header title={t('session.papersTitle')} sub={t(punjab ? 'session.papersSubPunjab' : 'session.papersSub')} back />

      {hasPapers ? (
        groups.map(({ year, papers }) => (
          <View key={year}>
            <SectionTitle>{t('session.papersYearHeading', { year, board: boardName(board, lang) })}</SectionTitle>
            <Card flat style={{ paddingVertical: 0 }}>
              {papers.map((p, i) => (
                <Item
                  key={p.key}
                  icon="doc"
                  title={p.label}
                  sub={p.selfHosted ? t('session.papersSelfHostedNote') : t('session.papersHostedNote', { host: p.host })}
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
      <Small>{t(punjab ? 'session.papersFootnotePunjab' : 'session.papersFootnote')}</Small>
    </Screen>
  );
}
