/**
 * Offline chapter downloads.
 *
 * A JSON snapshot per chapter and medium (sections, mcqs, flashcards, short
 * questions and blanks) plus the chapter's audio lesson, written to the
 * document directory so it survives app restarts, unlike the cache directory,
 * which the OS is free to clear under storage pressure.
 *
 * Audio used to be excluded, because the only tracks that existed shipped as
 * bundled assets and were therefore offline by definition. They stream from
 * Supabase Storage now, so a download that skipped them would leave a student
 * in a plane with notes and questions and a dead player, while the screen
 * still called the chapter "Offline".
 *
 * Registered with @matricmate/core's fetch layer through connectLocalContent,
 * so the reader, flashcards and practice screens pick up a download
 * automatically through the same fallback chain that already serves live
 * rows and the bundled sample: live, then this session's cache, then a
 * download, then the bundle. No screen needs to know a download exists; only
 * this file and store/app.tsx, which drives the download/delete toggle, do.
 *
 * core cannot do this itself. This file, not packages/core, is where the
 * filesystem lives: db.ts is shared with apps/web, which has no
 * expo-file-system (its own web shim just warns and returns nothing), so
 * importing it there would either break the web build or silently do
 * nothing. core only exposes the connectLocalContent hook; every actual
 * filesystem call is here.
 */
/**
 * NO STORAGE PERMISSION IS ASKED FOR, AND NONE SHOULD BE ADDED.
 *
 * Everything below writes under `Paths.document`, which is the app's own
 * private directory. Android has never required a permission to write there,
 * on any version, and Play treats a declared storage permission an app does
 * not need as grounds for rejection. READ_/WRITE_EXTERNAL_STORAGE are also
 * largely inert since Android 11's scoped storage.
 *
 * A permission prompt would therefore be a dialog that asks for something we
 * do not use, cannot justify at review, and that a student can refuse, which
 * would leave us handling a failure that cannot actually happen. The download
 * button just downloads.
 *
 * Two consequences worth knowing, both correct. The files do not appear in the
 * phone's Downloads folder or gallery, because they are ours, not the user's
 * media. And "Clear storage" in Android settings removes them along with
 * everything else, which is the same reset that signs the student out.
 */
import { Directory, File, Paths } from 'expo-file-system';
import {
  AudioTrack,
  Chapter,
  ChapterContent,
  Medium,
  api,
  connectLocalContent,
  contentBoard,
  fetchChapterContentLive,
  isOneLanguageSubject,
  pickAudioTrack,
} from '@matricmate/core';
import { audioUrl } from './audio';
import { supabase } from '../lib/supabase';

/**
 * Built on first use, never at import.
 *
 * This was `const ROOT = new Directory(...)` at module scope, which runs the
 * moment anything imports this file. expo-file-system's web shim has no working
 * Directory, so the constructor threw during module evaluation and took the
 * whole app down before a single screen rendered, on any platform where the
 * API is not what we expect. A downloads helper failing should cost you
 * downloads, not the app.
 *
 * Cached after the first successful construction, so this stays one object.
 */
let rootDir: Directory | null = null;

function root(): Directory | null {
  if (rootDir) return rootDir;
  try {
    rootDir = new Directory(Paths.document, 'downloads');
    return rootDir;
  } catch {
    // No usable filesystem here. Every caller below treats null as "nothing is
    // downloaded", which is exactly true.
    return null;
  }
}

const chapterDir = (chapterId: string): Directory | null => {
  const r = root();
  return r ? new Directory(r, chapterId) : null;
};
const snapshotFile = (chapterId: string, medium: Medium): File | null => {
  const dir = chapterDir(chapterId);
  return dir ? new File(dir, `${medium}.json`) : null;
};
const audioFile = (chapterId: string, medium: Medium): File | null => {
  const dir = chapterDir(chapterId);
  return dir ? new File(dir, `${medium}.mp3`) : null;
};
const audioMetaFile = (chapterId: string, medium: Medium): File | null => {
  const dir = chapterDir(chapterId);
  return dir ? new File(dir, `${medium}.audio.json`) : null;
};
/** One per chapter, not per medium: the row carries both titles. */
const chapterFile = (chapterId: string): File | null => {
  const dir = chapterDir(chapterId);
  return dir ? new File(dir, 'chapter.json') : null;
};

const otherMedium = (medium: Medium): Medium => (medium === 'en' ? 'ur' : 'en');

/**
 * WHAT A LANGUAGE SWITCH DOES TO A DOWNLOAD
 *
 * A download is saved under the medium the student had when they saved it,
 * because for most subjects the two mediums are two different texts. So after
 * a switch, a Physics chapter saved in English is still on the phone but is not
 * the Urdu chapter the student now reads, and it is reported as not readable
 * offline until it is downloaded again. It is not deleted: switching back finds
 * it, and it still costs space until removed.
 *
 * The subjects written in one language are the exception. English, Urdu, and
 * Islamiyat on the Punjab board read the same for every student, and their
 * content is filed under both mediums, so either saved copy is the right one
 * and a switch changes nothing about them. See subjectMedium in core.
 *
 * Audio is looser on purpose, the same call pickAudioTrack makes online: a
 * lesson in the other language beats no lesson, and its track row says which
 * language it is in, so the player can say so.
 */

/**
 * Which saved copy of a chapter serves a student reading in `medium`, or null
 * when nothing on disk can. Their own first, then, for a one-language subject
 * only, the other medium's.
 */
function servingMedium(chapterId: string, medium: Medium): Medium | null {
  if (snapshotFile(chapterId, medium)?.exists) return medium;
  const other = otherMedium(medium);
  if (isOneLanguageSubject(chapterId, contentBoard()) && snapshotFile(chapterId, other)?.exists) return other;
  return null;
}

/**
 * Whether a downloaded chapter can be opened offline by a student reading in
 * `medium`. False for a chapter downloaded only in the other medium, unless it
 * is a one-language subject (see above), and false when nothing is saved.
 */
export function readableOffline(chapterId: string, medium: Medium): boolean {
  try {
    return servingMedium(chapterId, medium) !== null;
  } catch {
    return false;
  }
}

/** The mediums a chapter's notes and questions are saved in on this phone. */
export function savedMediums(chapterId: string): Medium[] {
  try {
    return (['en', 'ur'] as const).filter((m) => Boolean(snapshotFile(chapterId, m)?.exists));
  } catch {
    return [];
  }
}

/**
 * Of these downloaded chapters, the ones a student reading in `medium` cannot
 * open offline and would have to download again. What a language switch is
 * about to cost, counted before it happens.
 */
export function needsDownloadIn(chapterIds: string[], medium: Medium): string[] {
  return chapterIds.filter((id) => !readableOffline(id, medium));
}

/** The track row saved in one medium's slot, or null. */
function savedTrack(chapterId: string, slot: Medium): AudioTrack | null {
  try {
    const file = audioMetaFile(chapterId, slot);
    if (!file?.exists) return null;
    return JSON.parse(file.textSync()) as AudioTrack;
  } catch {
    return null;
  }
}

/**
 * The saved track row for a downloaded lesson.
 *
 * Kept next to the MP3 because the row itself lives on the server, and a
 * student with no signal cannot fetch it. Without this the chapter hub would
 * hide the audio option for a chapter whose lesson is sitting on the phone,
 * and the player would have no duration to show.
 *
 * The row saved with this medium's download, then the other medium's: after a
 * language switch the lesson already on the phone still plays, and the row's
 * own `medium` tells the player which language it is. This is also the way to
 * ask whether a chapter has any recording on disk at all.
 */
export function localAudioTrack(chapterId: string, medium: Medium): AudioTrack | null {
  return savedTrack(chapterId, medium) ?? savedTrack(chapterId, otherMedium(medium));
}

/**
 * The saved chapter row, for naming a download with no connection.
 *
 * Same reasoning as the track row above, and it was the missing half of it.
 * The downloads and offline screens named their rows through `chapterById`,
 * whose offline fallback is the bundled catalogue, and the bundle is Class 9
 * by design. So a Class 10 student who opened the app with no signal was told
 * they had no downloads, over files that were sitting on the phone, on the one
 * screen the whole download feature exists for.
 *
 * A download already proves there was a connection, so the row is saved at
 * that moment and read back from disk afterwards. Chapters downloaded before
 * this existed have no file and still fall back to the catalogue.
 */
export function localChapter(chapterId: string): Chapter | null {
  try {
    const file = chapterFile(chapterId);
    if (!file?.exists) return null;
    return JSON.parse(file.textSync()) as Chapter;
  } catch {
    return null;
  }
}

/**
 * The on-disk lesson for a chapter, or null when it was never downloaded.
 *
 * The player prefers this over the streaming URL, so a downloaded chapter
 * plays with no signal and costs the student no data on a replay.
 *
 * `medium` is the language of the recording wanted, which is what the player
 * asks with. A download files its MP3 under the student's medium, but the
 * lessons for Urdu, English and Punjab Islamiyat exist in one language only,
 * so an English-medium student's Urdu lesson sits in the `en` slot as an Urdu
 * recording. Looked up by slot alone, the player asked for `ur` and found
 * nothing, and every such download was dead offline. So the saved track row
 * decides first, in either slot; the slot itself only answers for downloads
 * made before the row was kept beside the file.
 *
 * It does not hand back the other language's recording when this language's
 * is wanted: online, the player would then play a stale English file over the
 * Urdu one it could stream. For "is any lesson on disk", ask localAudioTrack.
 */
export function localAudioUri(chapterId: string, medium: Medium): string | null {
  try {
    for (const slot of [medium, otherMedium(medium)]) {
      const file = audioFile(chapterId, slot);
      if (file?.exists && savedTrack(chapterId, slot)?.medium === medium) return file.uri;
    }
    const own = audioFile(chapterId, medium);
    return own?.exists ? own.uri : null;
  } catch {
    return null;
  }
}

/**
 * True on-disk size of one chapter's offline copy, across every medium saved
 * for it, in bytes. Not an estimate: a real, recursive read of what is
 * actually sitting on the device right now.
 */
export function chapterDownloadBytes(chapterId: string): number {
  try {
    const dir = chapterDir(chapterId);
    return dir?.exists ? (dir.size ?? 0) : 0;
  } catch {
    // Same policy as every other accessor here: a broken filesystem costs
    // a size label, never the screen that asked for it.
    return 0;
  }
}

/** True on-disk size of every downloaded chapter combined, in bytes. */
export function totalDownloadBytes(): number {
  try {
    const r = root();
    return r?.exists ? (r.size ?? 0) : 0;
  } catch {
    return 0;
  }
}

/**
 * A human-sized rendering of a byte count for the downloads screen: KB below
 * 1 MB, MB above it. A chapter is a few tens of KB of text plus a couple of MB
 * of audio when it has a lesson, so the figure moves a lot between chapters.
 * Showing that honestly, rather than rounding to a reassuring constant, is the
 * point of measuring real size on disk at all.
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/**
 * Reads a chapter's offline snapshot, or null when nothing saved can serve
 * that medium. A one-language subject is served from either medium's copy;
 * see "what a language switch does" above.
 */
function readLocal(chapterId: string, medium: Medium): ChapterContent | null {
  try {
    const serving = servingMedium(chapterId, medium);
    const file = serving ? snapshotFile(chapterId, serving) : null;
    if (!file?.exists) return null;
    return JSON.parse(file.textSync()) as ChapterContent;
  } catch {
    // A half-written or corrupted snapshot must not crash a screen. Treat it
    // the same as "not downloaded" and let the rest of the fallback chain
    // (this session's cache, then the bundle) answer instead.
    return null;
  }
}

/**
 * Fetches a chapter's full content live and writes it to disk as one file.
 *
 * Written to a temp file inside the chapter's own folder first, and moved
 * into place only once the write has actually succeeded. readLocal only ever
 * looks at the final filename, never the temp one, so a crash or a dropped
 * connection mid-write can never leave a chapter looking downloaded when it
 * is really half-saved: either the move happens, atomically, on the same
 * volume, or the student is left with exactly what they had before, plus a
 * stray temp file this function cleans up on its way out.
 *
 * Throws on any failure, live fetch or disk. Deliberately calls
 * fetchChapterContentLive rather than the ordinary fetchChapterContent: the
 * latter's whole job is to always hand back something, cache or bundle
 * included, and a "successful" download that actually saved the bundled
 * sample under a chapter's name would be a silent lie the next time the
 * student opens it in the plane with no signal.
 */
export async function downloadChapter(chapterId: string, medium: Medium): Promise<void> {
  // The medium goes to the query itself. It used to be set app-wide first,
  // which emptied the whole content cache, and a language switch made while
  // a download was running was undone by it.
  const content = await fetchChapterContentLive(chapterId, supabase, medium);

  const dir = chapterDir(chapterId);
  const dest = snapshotFile(chapterId, medium);
  // No filesystem on this platform, so there is nowhere to put it. Throwing is
  // right: the caller already treats a rejection as a failed download and tells
  // the student, which beats silently reporting success for a file that is not
  // there.
  if (!dir || !dest) throw new Error('no filesystem available for downloads');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });

  const stamp = Date.now();

  /**
   * The audio comes down before the snapshot lands, and a failure here fails
   * the whole download.
   *
   * It is the big, slow, likely-to-drop part, and the caller only records the
   * chapter as downloaded when this function resolves. Saving the text anyway
   * would leave a chapter marked "Offline" whose lesson is missing, which is
   * the exact lie this file exists to avoid. The student is told it failed and
   * can retry on better signal.
   */
  const tracks = await api.getAudioTracks(chapterId, supabase);
  const track = pickAudioTrack(tracks, medium);
  const url = audioUrl(track);
  /* The row that names this chapter offline. Fetched here, where a connection
     is already proven, because the bundled catalogue cannot answer for Class
     10 and the offline library has nothing else to read a title from. */
  const row = await api.getChapter(chapterId, supabase);

  const scratch: File[] = [];
  const sweep = () => {
    for (const f of scratch) {
      try {
        if (f.exists) f.delete();
      } catch {
        // Best effort. A leftover .tmp file is a few stray KB, not a chapter
        // that looks downloaded when it is not: readLocal never looks for it
        // and it is swept up the next time this chapter downloads or deletes.
      }
    }
  };

  try {
    let audioTemp: File | null = null;
    let metaTemp: File | null = null;
    if (url && track) {
      audioTemp = await File.downloadFileAsync(url, new File(dir, `.${medium}.audio.tmp-${stamp}`));
      scratch.push(audioTemp);
      metaTemp = new File(dir, `.${medium}.meta.tmp-${stamp}`);
      scratch.push(metaTemp);
      metaTemp.write(JSON.stringify(track));
    }

    const temp = new File(dir, `.${medium}.tmp-${stamp}`);
    scratch.push(temp);
    temp.write(JSON.stringify(content));

    let rowTemp: File | null = null;
    if (row) {
      rowTemp = new File(dir, `.chapter.tmp-${stamp}`);
      scratch.push(rowTemp);
      rowTemp.write(JSON.stringify(row));
    }

    // Both files move into place only once both exist, so a chapter is never
    // half-downloaded from a reader's point of view.
    const audioDest = audioFile(chapterId, medium);
    const metaDest = audioMetaFile(chapterId, medium);
    const rowDest = chapterFile(chapterId);
    if (audioTemp && audioDest) audioTemp.moveSync(audioDest, { overwrite: true });
    if (metaTemp && metaDest) metaTemp.moveSync(metaDest, { overwrite: true });
    if (rowTemp && rowDest) rowTemp.moveSync(rowDest, { overwrite: true });
    temp.moveSync(dest, { overwrite: true });
  } catch (e) {
    sweep();
    throw e;
  }
}

/**
 * Removes every file this chapter has on disk, in any medium.
 *
 * Never throws. The class and board switches call this after the server has
 * already said yes, and a filesystem error thrown there left the phone on the
 * old syllabus while the account had moved on. A folder that would not delete
 * is a few stray megabytes; the next delete or download sweeps it.
 */
export function deleteChapterDownload(chapterId: string): void {
  try {
    const dir = chapterDir(chapterId);
    if (dir?.exists) dir.delete();
  } catch {
    /* see above */
  }
}

/**
 * Removes every chapter downloaded on this device, in one call.
 *
 * Used when resetting local demo data (Settings > Reset demo data): that
 * action already wipes state.downloads back to empty, and without this the
 * files behind those entries would live on with nothing left in state to
 * point at them, taking up space forever with no way for the student to
 * delete them from the downloads screen again.
 *
 * Never throws, for the same reason as deleteChapterDownload.
 */
export function deleteAllDownloads(): void {
  try {
    const r = root();
    if (r?.exists) r.delete();
  } catch {
    /* see deleteChapterDownload */
  }
}

connectLocalContent(async (chapterId, medium) => readLocal(chapterId, medium));
