import 'server-only';
import { cache } from 'react';
import { api } from '@matricmate/core';
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

export const getChapter = cache(async (id: string) => api.getChapter(id, await client()));
export const getChapterContent = cache(async (id: string) => api.getChapterContent(id, await client()));
export const getSubject = cache(async (id: string) => api.getSubject(id, await client()));
export const getSubjects = cache(async (ids?: string[]) => api.getSubjects(ids, await client()));
export const getChapters = cache(async (subjectId: string) => api.getChapters(subjectId, await client()));
