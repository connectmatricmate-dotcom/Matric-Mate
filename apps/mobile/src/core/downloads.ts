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
import { Directory, File, Paths } from 'expo-file-system';
import {
  AudioTrack,
  ChapterContent,
  Medium,
  api,
  connectLocalContent,
  fetchChapterContentLive,
  pickAudioTrack,
  setContentMedium,
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

/**
 * The saved track row for a downloaded lesson.
 *
 * Kept next to the MP3 because the row itself lives on the server, and a
 * student with no signal cannot fetch it. Without this the chapter hub would
 * hide the audio option for a chapter whose lesson is sitting on the phone,
 * and the player would have no duration to show.
 */
export function localAudioTrack(chapterId: string, medium: Medium): AudioTrack | null {
  try {
    const file = audioMetaFile(chapterId, medium);
    if (!file?.exists) return null;
    return JSON.parse(file.textSync()) as AudioTrack;
  } catch {
    return null;
  }
}

/**
 * The on-disk lesson for a chapter, or null when it was never downloaded.
 *
 * The player prefers this over the streaming URL, so a downloaded chapter
 * plays with no signal and costs the student no data on a replay.
 */
export function localAudioUri(chapterId: string, medium: Medium): string | null {
  try {
    const file = audioFile(chapterId, medium);
    return file?.exists ? file.uri : null;
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

/** Reads a chapter's offline snapshot, or null when nothing was saved for that medium. */
function readLocal(chapterId: string, medium: Medium): ChapterContent | null {
  try {
    const file = snapshotFile(chapterId, medium);
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
  setContentMedium(medium);
  const content = await fetchChapterContentLive(chapterId, supabase);

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

    // Both files move into place only once both exist, so a chapter is never
    // half-downloaded from a reader's point of view.
    const audioDest = audioFile(chapterId, medium);
    const metaDest = audioMetaFile(chapterId, medium);
    if (audioTemp && audioDest) audioTemp.moveSync(audioDest, { overwrite: true });
    if (metaTemp && metaDest) metaTemp.moveSync(metaDest, { overwrite: true });
    temp.moveSync(dest, { overwrite: true });
  } catch (e) {
    sweep();
    throw e;
  }
}

/** Removes every file this chapter has on disk, in any medium. */
export function deleteChapterDownload(chapterId: string): void {
  const dir = chapterDir(chapterId);
  if (dir?.exists) dir.delete();
}

/**
 * Removes every chapter downloaded on this device, in one call.
 *
 * Used when resetting local demo data (Settings > Reset demo data): that
 * action already wipes state.downloads back to empty, and without this the
 * files behind those entries would live on with nothing left in state to
 * point at them, taking up space forever with no way for the student to
 * delete them from the downloads screen again.
 */
export function deleteAllDownloads(): void {
  const r = root();
  if (r?.exists) r.delete();
}

connectLocalContent(async (chapterId, medium) => readLocal(chapterId, medium));
