import 'server-only';
import { cache } from 'react';
import { api, fetchAiSession } from '@matricmate/core';
import type { Medium, PlayableTrack } from '@matricmate/core';
import { createClient } from '@/lib/supabase/server';

/**
 * Server-side content readers, deduplicated with React.cache.
 *
 * generateMetadata and the page body both need the chapter, and without the
 * cache each render paid for the read twice. Same rule as getUser in
 * lib/supabase/server.ts: one read per request, however many components ask.
 *
 * WHY THESE BUILD THEIR OWN CLIENT EVERY TIME
 *
 * The browser connects one long-lived client to the shared content layer with
 * `connectContent`, and so does the mobile app. A server cannot. Module state
 * in Next is shared across every request, so a client built from one student's
 * cookies would be sitting there when the next student's page renders. That is
 * not a rendering bug, it is one student reading another's session.
 *
 * So the client is created per request and passed in. React.cache scopes the
 * dedup to a single request too, which is exactly the lifetime we want.
 *
 * This file existing and NOT doing this is what made the whole app show
 * placeholder text while 2202 real questions sat in the database: with no
 * client, every read fell straight through to the bundled fallback.
 */
const client = cache(() => createClient());

/**
 * The signed-in student's study medium, read once per request.
 *
 * The content layer keeps the medium in module state, which is correct on a
 * device where one student owns the process and wrong on a server where every
 * request shares it. Nothing server-side ever set it, so it stayed 'en' and
 * every Urdu-medium student was served English notes on the reader, the
 * chapter hub and all three practice pages.
 */
const studentMedium = cache(async (): Promise<Medium> => {
  const supabase = await client();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return 'en';
  const { data } = await supabase.from('profiles').select('onboarding').eq('id', auth.user.id).maybeSingle();
  const onboarding = data?.onboarding as { medium?: Medium } | null;
  return onboarding?.medium === 'ur' ? 'ur' : 'en';
});

export const getChapter = cache(async (id: string) => api.getChapter(id, await client()));
export const getChapterContent = cache(async (id: string) =>
  api.getChapterContent(id, await client(), await studentMedium()),
);
export const getSubject = cache(async (id: string) => api.getSubject(id, await client()));
export const getSubjects = cache(async (ids?: string[]) => api.getSubjects(ids, await client()));
export const getChapters = cache(async (subjectId: string) => api.getChapters(subjectId, await client()));
export const getFlashcards = cache(async (chapterId: string) =>
  api.getFlashcards(chapterId, await client(), await studentMedium()),
);
/** An AI-generated set, read under the student's own cookie session (RLS). */
export const getAiSession = cache(async (id: string) => fetchAiSession(id, await client()));

/*
 * EVERY server-side content read goes through this file. No exceptions.
 *
 * `api.getFlashcards(id)` called straight from a page compiles, runs, returns
 * plausible data and is wrong: with no client the fetch layer falls through to
 * the bundled sample, so the page renders placeholder text next to a correct
 * chapter title. Three session pages did exactly that and shipped, and the only
 * reason it was caught is that a student noticed the flashcards said "the full
 * definition comes with the client's notes".
 *
 * If you need a new read on the server, add a reader here rather than reaching
 * for `api` in the page.
 */

/**
 * A chapter's recordings with playable URLs.
 *
 * The bucket is public, so a plain public URL is enough and the player needs no
 * expiry handling. Resolved here, on the server, because the storage path in
 * the row is deliberately relative to whichever Supabase project is current.
 */
export const getAudioTracks = cache(async (id: string): Promise<PlayableTrack[]> => {
  const c = await client();
  const tracks = await api.getAudioTracks(id, c);
  return tracks.map((t) => ({ ...t, url: c.storage.from('audio').getPublicUrl(t.storagePath).data.publicUrl }));
});
