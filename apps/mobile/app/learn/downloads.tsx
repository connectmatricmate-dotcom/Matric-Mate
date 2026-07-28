import { View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { Bar, Btn, Card, Empty, Header, Item, Row, Screen, SectionTitle, Small, Spacer, Tap, useToast } from '../../src/components/ui';
import { chapterById, subjectById } from '@matricmate/core';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, S } from '../../src/theme';

const MB_PER_CHAPTER = 41;
const CAP_MB = 512;

export default function Downloads() {
  const { state, actions } = useApp();
  const t = useT();
  const toast = useToast();
  const chapters = state.downloads.map(chapterById).filter(Boolean);
  const used = chapters.length * MB_PER_CHAPTER;

  const bySubject = chapters.reduce<Record<string, typeof chapters>>((acc, c) => {
    if (!c) return acc;
    (acc[c.subjectId] ||= []).push(c);
    return acc;
  }, {});

  return (
    <Screen>
      <Header title={t('downloads.title')} sub={t('downloads.sub')} back />

      <Card>
        <Row gap={S.md}>
          <Icon name="download" color={C.teal} />
          <View style={{ flex: 1 }}>
            <Small style={{ color: C.ink }}>{t('downloads.used', { n: used })}</Small>
            <View style={{ marginTop: 8 }}>
              <Bar pct={(used / CAP_MB) * 100} tone="teal" />
            </View>
          </View>
          <Small>{t('downloads.cap', { n: CAP_MB })}</Small>
        </Row>
      </Card>

      {chapters.length === 0 ? (
        <>
          <Spacer h={S.lg} />
          <Empty
            emoji="📭"
            title={t('downloads.emptyTitle')}
            sub={t('downloads.emptyBody')}
            cta={<Btn title={t('downloads.browse')} sm variant="line" onPress={() => router.push('/(tabs)/study')} />}
          />
        </>
      ) : (
        Object.entries(bySubject).map(([subjectId, list]) => (
          <View key={subjectId}>
            <SectionTitle>{subjectById(subjectId)?.name}</SectionTitle>
            <Card flat style={{ paddingVertical: 0 }}>
              {list.map((c, i) => (
                <Item
                  key={c!.id}
                  title={c!.title}
                  sub={t('downloads.perChapter', { n: MB_PER_CHAPTER })}
                  icon="check"
                  tone="green"
                  last={i === list.length - 1}
                  onPress={() => router.push(`/learn/chapter/${c!.id}`)}
                  right={
                    <Tap
                      onPress={() => {
                        actions.toggleDownload(c!.id);
                        toast(t('study.removedOffline'));
                      }}
                      hit
                    >
                      <Icon name="trash" size={19} color={C.red} />
                    </Tap>
                  }
                />
              ))}
            </Card>
          </View>
        ))
      )}

      <Spacer h={S.lg} />
      <Small>{t('downloads.footnote')}</Small>
    </Screen>
  );
}
