/**
 * Android-side resolution of a published recording to something expo-audio can
 * play.
 *
 * This was a map of two bundled MP3s keyed by a hardcoded track id, so the app
 * could only ever play the one demo chapter, and both files shipped inside the
 * APK. Lessons now live in the public `audio` bucket and stream, which keeps
 * the download size flat as the library grows and means a chapter starts
 * playing the moment its recording is published, with no new build.
 *
 * The URL is built from the project URL rather than asked of the Supabase
 * client. getPublicUrl() is pure string work that needs no network, so routing
 * it through the client bought nothing and made playback depend on a client
 * that can be a throwing stub when the app is misconfigured. A player should
 * not go dark because of that.
 */
import type { AudioTrack } from '@matricmate/core';

const BUCKET = 'audio';
const BASE = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');

/** Public URL for a track, or null when there is nothing to play. */
export const audioUrl = (track: AudioTrack | null | undefined): string | null =>
  BASE && track?.storagePath ? `${BASE}/storage/v1/object/public/${BUCKET}/${track.storagePath}` : null;

/** The same thing shaped as an expo-audio source. */
export const audioSource = (track: AudioTrack | null | undefined): { uri: string } | null => {
  const uri = audioUrl(track);
  return uri ? { uri } : null;
};
