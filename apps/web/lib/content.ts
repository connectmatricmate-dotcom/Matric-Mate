'use client';

/**
 * Point the shared content layer at the browser Supabase client.
 *
 * Imported for its side effect by lib/store.tsx, and evaluated at module scope
 * rather than in an effect: pages under /(app) render immediately, and a
 * chapter list that shows bundled sample content for one frame and then swaps
 * to the real rows reads as a bug rather than as a load.
 *
 * Browser only, and this file is only half the story. Server components cannot
 * share this client: module state in Next is shared across requests, so a
 * client built from one student's cookies would still be sitting there when the
 * next student's page renders. Server reads therefore build their own client
 * per request in lib/content-readers.ts. Both halves are needed. When only this
 * one existed, every server-rendered page served placeholder text while the
 * real content sat in the database.
 */
import { connectContent, primeAllContent } from '@matricmate/core';
import { createClient } from '@/lib/supabase/client';

if (typeof window !== 'undefined') {
  const client = createClient();
  connectContent(client);
  // Warm the synchronous lookups in core. Without this the browser answers
  // chapterById from the bundle, so a heading shows the old chapter name beside
  // a body full of new content. Not awaited: it is a warm-up, not a dependency.
  // It can run before the session is known and come back empty, so the store
  // loads the index again once it knows who is signed in, and after every
  // class, board or language change (lib/store.tsx).
  void primeAllContent(client);
}

export {};
