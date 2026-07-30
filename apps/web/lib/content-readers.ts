import 'server-only';
import { cache } from 'react';
import { api } from '@matricmate/core';

/**
 * Server-side content readers, deduplicated with React.cache.
 *
 * generateMetadata and the page body both need the chapter, and without the
 * cache each render paid for the read twice. Same rule as getUser in
 * lib/supabase/server.ts: one read per request, however many components ask.
 * When Supabase lands, these become query calls and the dedup matters more.
 */
export const getChapter = cache((id: string) => api.getChapter(id));
export const getChapterContent = cache((id: string) => api.getChapterContent(id));
export const getSubject = cache((id: string) => api.getSubject(id));
export const getChapters = cache((subjectId: string) => api.getChapters(subjectId));
