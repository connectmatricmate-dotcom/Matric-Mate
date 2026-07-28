import { View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { Bar, Btn, Card, Empty, Header, Item, Row, Screen, SectionTitle, Small, Spacer, Tap, useToast } from '../../src/components/ui';
import { chapterById, subjectById } from '../../src/core/content';
import { useApp } from '../../src/store/app';
import { C, S } from '../../src/theme';

const MB_PER_CHAPTER = 41;
const CAP_MB = 512;

export default function Downloads() {
  const { state, actions } = useApp();
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
      <Header title="Downloads" sub="Available without internet" back />

      <Card>
        <Row gap={S.md}>
          <Icon name="download" color={C.teal} />
          <View style={{ flex: 1 }}>
            <Small style={{ color: C.ink }}>{used} MB used</Small>
            <View style={{ marginTop: 7 }}>
              <Bar pct={(used / CAP_MB) * 100} tone="teal" />
            </View>
          </View>
          <Small>of {CAP_MB} MB</Small>
        </Row>
      </Card>

      {chapters.length === 0 ? (
        <>
          <Spacer h={S.lg} />
          <Empty
            emoji="📭"
            title="No downloads yet"
            sub="Save a chapter and study without internet — useful when data runs out."
            cta={<Btn title="Browse subjects" sm variant="line" onPress={() => router.push('/(tabs)/study')} />}
          />
        </>
      ) : (
        Object.entries(bySubject).map(([subjectId, list]) => (
          <View key={subjectId}>
            <SectionTitle>{subjectById(subjectId)?.name}</SectionTitle>
            <Card flat style={{ paddingVertical: 2 }}>
              {list.map((c, i) => (
                <Item
                  key={c!.id}
                  title={`Ch ${c!.number} · ${c!.title}`}
                  sub={`${MB_PER_CHAPTER} MB · notes, audio, MCQs`}
                  icon="check"
                  tone="green"
                  last={i === list.length - 1}
                  onPress={() => router.push(`/learn/chapter/${c!.id}`)}
                  right={
                    <Tap
                      onPress={() => {
                        actions.toggleDownload(c!.id);
                        toast('Removed from downloads');
                      }}
                      hit
                    >
                      <Icon name="trash" size={18} color={C.red} />
                    </Tap>
                  }
                />
              ))}
            </Card>
          </View>
        ))
      )}

      <Spacer h={S.lg} />
      <Small>Downloads happen on Wi-Fi by default. Attempts made offline sync when you reconnect.</Small>
    </Screen>
  );
}
