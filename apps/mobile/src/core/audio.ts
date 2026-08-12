/**
 * Android-side resolution of a published recording to something expo-audio can
 * play.
 *
 * This was a map of two bundled MP3s keyed by a hardcoded track id, so the app
 * could only ever play the one demo chapter, and both files shipped inside the
 * APK. Lessons now live in the public `audio` bucket and stream, which keeps
 * the download size flat as the library grows and means a chapter starts
 * playing the moment its recording is published, with no new build.
 */
import type { AudioTrack } from '@matricmate/core';
import { supabase } from '../lib/supabase';

/** Public URL for a track, or null when there is nothing to play. */
export const audioUrl = (track: AudioTrack | null | undefined): string | null =>
  track ? (supabase.storage.from('audio').getPublicUrl(track.storagePath).data.publicUrl ?? null) : null;

/** The same thing shaped as an expo-audio source. */
export const audioSource = (track: AudioTrack | null | undefined): { uri: string } | null => {
  const uri = audioUrl(track);
  return uri ? { uri } : null;
};
