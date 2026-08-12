/**
 * Offline chapter downloads.
 *
 * A JSON snapshot per chapter and medium (sections, mcqs, flashcards, short
 * questions and blanks), written to the document directory so it survives
 * app restarts, unlike the cache directory, which the OS is free to clear
 * under storage pressure. Audio is not part of this: the only tracks that
 * exist today ship as bundled assets (see core/audio.ts), so there is
 * nothing to fetch and cache for them yet.
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
import { ChapterContent, Medium, connectLocalContent, fetchChapterContentLive, setContentMedium } from '@matricmate/core';
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

/**
 * True on-disk size of one chapter's offline copy, across every medium saved
 * for it, in bytes. Not an estimate: a real, recursive read of what is
 * actually sitting on the device right now.
 */
export function chapterDownloadBytes(chapterId: string): number {
  const dir = chapterDir(chapterId);
  return dir?.exists ? (dir.size ?? 0) : 0;
}

/** True on-disk size of every downloaded chapter combined, in bytes. */
export function totalDownloadBytes(): number {
  const r = root();
  return r?.exists ? (r.size ?? 0) : 0;
}

/**
 * A human-sized rendering of a byte count for the downloads screen: KB below
 * 1 MB, MB above it. These snapshots are plain JSON text with no audio in
 * them, so most chapters land in the tens of KB, not the tens of MB an audio
 * bundle would need. Showing that honestly, rather than rounding up to a
 * reassuring "1 MB", is the point of measuring real size on disk at all.
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

  const temp = new File(dir, `.${medium}.tmp-${Date.now()}`);
  try {
    temp.write(JSON.stringify(content));
    temp.moveSync(dest, { overwrite: true });
  } catch (e) {
    if (temp.exists) {
      try {
        temp.delete();
      } catch {
        // Best effort. A leftover .tmp file is a few stray KB, not a chapter
        // that looks downloaded when it is not: readLocal never looks for it
        // and it is swept up the next time this chapter downloads or deletes.
      }
    }
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
