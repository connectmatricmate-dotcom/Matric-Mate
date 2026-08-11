'use client';

/**
 * Point the shared content layer at the browser Supabase client.
 *
 * Imported for its side effect by the app layout, and evaluated at module scope
 * rather than in an effect: pages under /(app) render immediately, and a
 * chapter list that shows bundled sample content for one frame and then swaps
 * to the real rows reads as a bug rather than as a load.
 *
 * Browser only. Server components render on Vercel where there is no student
 * session, and content reads there would come back as the anon role seeing
 * nothing. Anything server-rendered keeps using the bundled content, which is
 * the same structure, so the two never disagree about what a chapter is called.
 */
import { connectContent } from '@matricmate/core';
import { createClient } from '@/lib/supabase/client';

if (typeof window !== 'undefined') connectContent(createClient());

export {};
