import { useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { Btn, Card, Confirm, Empty, Header, Item, Row, Screen, SectionTitle, Small, Spacer, Tap, useToast } from '../../src/components/ui';
import { chapterById, chapterName, subjectById, subjectName } from '@matricmate/core';
import type { Chapter, Medium } from '@matricmate/core';
import { useOnline } from '../../src/core/connectivity';
import {
  chapterDownloadBytes,
  formatBytes,
  localAudioTrack,
  localChapter,
  readableOffline,
  savedMediums,
  totalDownloadBytes,
} from '../../src/core/downloads';
import { useLang, useT } from '../../src/i18n';
import { useApp } from '../../src/store/app';
import { C, S } from '../../src/theme';

/*
 * No storage cap is shown. The screen used to put "of 512 MB" and a bar
 * against it beside the total, and nothing anywhere enforced the 512: a
 * number that only looked like a limit.
 */

type DownloadRow = { chapter: Chapter; readable: boolean; savedIn: Medium | undefined; bytes: number; audio: boolean };

export default function Downloads() {
  const { state, actions } = useApp();
  const t = useT();
  const { lang } = useLang();
  const toast = useToast();
  const online = useOnline();
  const medium = state.settings.contentMedium;
  const [removing, setRemoving] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  /** Moved after a download lands, so the rows read the disk again. */
  const [saves, setSaves] = useState(0);

  /**
   * One read of the disk per row, when the list, the language or a download
   * changes. The saved row first, so a chapter is still named with no
   * connection (see localChapter: the bundled catalogue is Class 9 only). And
   * whether each copy opens in the language the app is in now: a download is
   * saved in the medium it was made in, so after a switch a two-language
   * subject's copy is "saved in the other language", not available offline.
   */
  const rows = useMemo(
    () =>
      state.downloads
        .map((id): DownloadRow | null => {
          const chapter = localChapter(id) ?? chapterById(id);
          if (!chapter) return null;
          return {
            chapter,
            readable: readableOffline(id, medium),
            savedIn: savedMediums(id)[0],
            bytes: chapterDownloadBytes(id),
            audio: localAudioTrack(id, medium) !== null,
          };
        })
        .filter((r): r is DownloadRow => r !== null),
    // `saves` is not read here and has to be listed: a download in the new
    // language changes what is on disk without changing the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.downloads, medium, saves],
  );
  // Read straight off the filesystem, not from an estimate: this is what a
  // "true size on disk" figure means.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const usedBytes = useMemo(() => totalDownloadBytes(), [state.downloads, saves]);
  const someNeedAgain = rows.some((r) => !r.readable);

  const bySubject = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    (acc[r.chapter.subjectId] ||= []).push(r);
    return acc;
  }, {});

  async function saveAgain(chapterId: string) {
    setSaving(chapterId);
    const result = await actions.downloadChapter(chapterId);
    setSaving(null);
    setSaves((n) => n + 1);
    toast(result === 'downloaded' ? t('study.savedOffline') : t('downloads.saveFailed'));
  }

  const langName = (m: Medium | undefined) => (m === 'ur' ? t('lang.mediumUrdu') : t('lang.mediumEnglish'));

  return (
    <Screen>
      <Header title={t('downloads.title')} sub={t('downloads.sub')} back />

      <Card>
        <Row gap={S.md}>
          <Icon name="download" color={C.teal} />
          <View style={{ flex: 1 }}>
            <Small style={{ color: C.ink }}>{t('downloads.used', { n: formatBytes(usedBytes) })}</Small>
          </View>
        </Row>
      </Card>

      {/* What a language switch did to these, said where it shows. */}
      {someNeedAgain ? (
        <Card flat tint={C.orangeTint} style={{ marginTop: S.md }}>
          <Small>{t('downloads.languageNote')}</Small>
        </Card>
      ) : null}

      {rows.length === 0 ? (
        <>
          <Spacer h={S.lg} />
          <Empty
            emoji="📭"
            title={t('downloads.emptyTitle')}
            sub={t('downloads.emptyBody')}
            cta={
              state.premium.active ? (
                <Btn title={t('downloads.browse')} sm variant="line" onPress={() => router.dismissTo('/(tabs)/study')} />
              ) : undefined
            }
          />
        </>
      ) : (
        Object.entries(bySubject).map(([subjectId, list]) => (
          <View key={subjectId}>
            <SectionTitle>{subjectName(subjectById(subjectId), lang)}</SectionTitle>
            <Card flat style={{ paddingVertical: 0 }}>
              {list.map((r, i) => (
                <Item
                  key={r.chapter.id}
                  title={chapterName(r.chapter, lang)}
                  sub={
                    r.readable
                      ? // "audio" only where a lesson is actually saved.
                        t(r.audio ? 'downloads.perChapter' : 'downloads.perChapterNoAudio', { n: formatBytes(r.bytes) })
                      : t('downloads.savedIn', { lang: langName(r.savedIn) })
                  }
                  icon={r.readable ? 'check' : 'download'}
                  tone={r.readable ? 'green' : 'orange'}
                  last={i === list.length - 1}
                  // Without a plan this list is for freeing space only: the
                  // chapter would close again at once (PlanGate). Offline, a
                  // copy in the other language cannot open, and says so.
                  onPress={
                    !state.premium.active
                      ? undefined
                      : !r.readable && !online
                        ? () => toast(t('downloads.savedIn', { lang: langName(r.savedIn) }))
                        : () => router.push(`/learn/chapter/${r.chapter.id}`)
                  }
                  right={
                    <Row gap={S.md}>
                      {!r.readable && online && state.premium.active ? (
                        saving === r.chapter.id ? (
                          <ActivityIndicator size="small" color={C.teal} />
                        ) : (
                          <Tap onPress={() => void saveAgain(r.chapter.id)} hit label={t('downloads.downloadAgain')}>
                            <Icon name="refresh" size={19} color={C.teal} />
                          </Tap>
                        )
                      ) : null}
                      <Tap onPress={() => setRemoving(r.chapter.id)} hit label={t('study.removeOffline')}>
                        <Icon name="trash" size={19} color={C.red} />
                      </Tap>
                    </Row>
                  }
                />
              ))}
            </Card>
          </View>
        ))
      )}

      <Spacer h={S.lg} />
      <Small>{t('downloads.footnoteSync')}</Small>

      {/* Deleting asks first: one tap used to remove a chapter that, with no
          signal, cannot be downloaded again. */}
      <Confirm
        visible={removing !== null}
        onClose={() => setRemoving(null)}
        title={t('study.removeOffline')}
        body={t('downloads.removeBody')}
        confirmLabel={t('study.removeOffline')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          if (removing) actions.removeDownload(removing);
          setRemoving(null);
          toast(t('study.removedOffline'));
        }}
      />
    </Screen>
  );
}
