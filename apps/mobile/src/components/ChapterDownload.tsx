import { useMemo, useState } from 'react';
import { readableOffline, savedMediums } from '../core/downloads';
import { useT } from '../i18n';
import { useApp } from '../store/app';
import { Confirm, useToast } from './ui';

/**
 * A chapter's download button, the same on the chapter hub and the player.
 *
 * Three states, not two. A chapter can be listed as downloaded and still not
 * open offline in the language the student reads now: each download is saved
 * in the medium it was made in, so after a language switch it is really "saved
 * in the other language". That one downloads again in this language, and never
 * removes; only a copy that works is offered for deletion.
 *
 * And deleting asks first. It used to be one tap, which on a bus with no
 * signal is a chapter gone until the student is back on the internet.
 */
export function useChapterDownload(chapterId: string) {
  const { state, actions } = useApp();
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  /** Moved after a download lands, so the disk is read again. */
  const [saves, setSaves] = useState(0);
  const medium = state.settings.contentMedium;
  const listed = state.downloads.includes(chapterId);

  // Disk reads, so only when something that decides them changes: the audio
  // player re-renders twice a second while it plays.
  const readable = useMemo(
    () => listed && readableOffline(chapterId, medium),
    // `saves` is not read here and has to be listed: a download in the new
    // language changes what is on disk without changing `listed`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listed, chapterId, medium, saves],
  );
  const savedIn = useMemo(
    () => (listed && !readable ? savedMediums(chapterId)[0] : undefined),
    [listed, readable, chapterId],
  );

  async function save() {
    setBusy(true);
    const result = await actions.downloadChapter(chapterId);
    setBusy(false);
    setSaves((n) => n + 1);
    toast(result === 'downloaded' ? t('study.savedOffline') : t('downloads.saveFailed'));
  }

  const press = () => {
    if (busy) return;
    if (readable) setConfirming(true);
    else void save();
  };

  const confirm = (
    <Confirm
      visible={confirming}
      onClose={() => setConfirming(false)}
      title={t('study.removeOffline')}
      body={t('downloads.removeBody')}
      confirmLabel={t('study.removeOffline')}
      cancelLabel={t('common.cancel')}
      onConfirm={() => {
        setConfirming(false);
        actions.removeDownload(chapterId);
        toast(t('study.removedOffline'));
      }}
    />
  );

  /** "Saved in Urdu. Download again...", for a copy the current language cannot open. */
  const savedInNote = savedIn
    ? t('downloads.savedIn', { lang: savedIn === 'ur' ? t('lang.mediumUrdu') : t('lang.mediumEnglish') })
    : null;

  return { busy, listed, readable, press, confirm, savedInNote };
}
