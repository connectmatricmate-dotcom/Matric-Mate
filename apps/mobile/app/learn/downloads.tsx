import { View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { Bar, Btn, Card, Empty, Header, Item, Row, Screen, SectionTitle, Small, Spacer, Tap, useToast } from '../../src/components/ui';
import { chapterById, subjectById } from '@matricmate/core';
import { chapterDownloadBytes, formatBytes, totalDownloadBytes } from '../../src/core/downloads';
import { useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, S } from '../../src/theme';

const CAP_MB = 512;

export default function Downloads() {
  const { state, actions } = useApp();
  const t = useT();
  const toast = useToast();
  const chapters = state.downloads.map(chapterById).filter(Boolean);
  // Read straight off the filesystem, not from an estimate: this is what a
  // "true size on disk" figure means. Both calls are fast, synchronous local
  // reads, so doing them at render time (recomputed whenever state.downloads
  // changes) needs no separate loading state.
  const usedBytes = totalDownloadBytes();
  const usedPct = (usedBytes / (1024 * 1024) / CAP_MB) * 100;

  const bySubject = chapters.reduce<Record<string, typeof chapters>>((acc, c) => {
    if (!c) return acc;
    (acc[c.subjectId] ||= []).push(c);
    return acc;
  }, {});

  async function remove(chapterId: string) {
    const result = await actions.toggleDownload(chapterId);
    if (result === 'removed') toast(t('study.removedOffline'));
  }

  return (
    <Screen>
      <Header title={t('downloads.title')} sub={t('downloads.sub')} back />

      <Card>
        <Row gap={S.md}>
          <Icon name="download" color={C.teal} />
          <View style={{ flex: 1 }}>
            <Small style={{ color: C.ink }}>{t('downloads.used', { n: formatBytes(usedBytes) })}</Small>
            <View style={{ marginTop: 8 }}>
              <Bar pct={usedPct} tone="teal" />
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
                  sub={t('downloads.perChapter', { n: formatBytes(chapterDownloadBytes(c!.id)) })}
                  icon="check"
                  tone="green"
                  last={i === list.length - 1}
                  onPress={() => router.push(`/learn/chapter/${c!.id}`)}
                  right={
                    <Tap onPress={() => remove(c!.id)} hit>
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
