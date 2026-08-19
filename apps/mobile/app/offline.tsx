/**
 * The whole app, minus everything that needs a server.
 *
 * A student with no signal still opens MatricMate and lands here rather than on
 * a home screen of spinners and failed requests. The session is already on the
 * device, so no login round trip is needed, and anything they downloaded is
 * fully usable: notes, audio, flashcards and questions.
 *
 * This screen is only the entry point. Tapping a chapter opens the ordinary
 * chapter hub and the ordinary reader and practice screens, which already read
 * from disk through core's local-content hook. Building offline copies of those
 * screens would mean maintaining two of everything and fixing every bug twice.
 */
import { View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { chapterById, chapterName, subjectById, subjectName } from '@matricmate/core';
import { Icon } from '../src/components/Icon';
import { Card, Empty, Header, Item, Screen, SectionTitle, Small, Spacer, Tap } from '../src/components/ui';
import { useOnline } from '../src/core/connectivity';
import { chapterDownloadBytes, formatBytes, localChapter } from '../src/core/downloads';
import { useLang, useT } from '../src/i18n';
import { useApp } from '../src/store/app';
import { C, S } from '../src/theme';

export default function Offline() {
  const { state, actions, hydrated } = useApp();
  const online = useOnline();
  const t = useT();
  const { lang } = useLang();

  // Signal is back, so there is no reason to keep the student in a reduced app.
  if (online) return <Redirect href="/(tabs)" />;
  if (!hydrated) return null;

  /**
   * The saved row first, the catalogue second.
   *
   * This used to be `map(chapterById)`, whose offline fallback is the bundled
   * catalogue: Class 9 only, by design. A Class 10 student with no signal was
   * therefore told they had no downloads, on the screen that exists for exactly
   * that moment. The row saved beside each download answers without a network.
   */
  const chapters = state.downloads.map((id) => localChapter(id) ?? chapterById(id)).filter(Boolean);

  return (
    <Screen>
      <Header title={t('offline.title')} sub={t('offline.sub')} />

      {chapters.length === 0 ? (
        <>
          <Spacer h={S.lg} />
          <Empty emoji="📡" title={t('offline.emptyTitle')} sub={t('offline.emptyBody')} />
        </>
      ) : (
        Object.entries(
          chapters.reduce<Record<string, typeof chapters>>((acc, c) => {
            if (!c) return acc;
            (acc[c.subjectId] ||= []).push(c);
            return acc;
          }, {}),
        ).map(([subjectId, list]) => (
          <View key={subjectId}>
            <SectionTitle>{subjectName(subjectById(subjectId), lang)}</SectionTitle>
            <Card flat style={{ paddingVertical: 0 }}>
              {list.map((c, i) => (
                <Item
                  key={c!.id}
                  title={chapterName(c, lang)}
                  sub={t('downloads.perChapter', { n: formatBytes(chapterDownloadBytes(c!.id)) })}
                  icon="check"
                  tone="green"
                  last={i === list.length - 1}
                  onPress={() => router.push(`/learn/chapter/${c!.id}`)}
                  right={
                    <Tap onPress={() => actions.toggleDownload(c!.id)} hit>
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
      <Small>{t('offline.footnote')}</Small>
    </Screen>
  );
}
