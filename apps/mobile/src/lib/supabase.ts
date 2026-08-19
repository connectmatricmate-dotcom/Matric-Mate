/**
 * Must be the first import here, and this module is imported before any
 * Supabase code runs.
 *
 * React Native ships its own URL class, a string-concatenation stand-in whose
 * properties are getters with no setters. `createClient` builds the realtime
 * endpoint by assigning `url.protocol = 'wss'`, which on that class throws
 * "Cannot set property protocol of [object Object] which has only a getter".
 * The polyfill replaces the global with a spec-compliant implementation that
 * has the setters, which is what Supabase's own React Native guide requires.
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetch as expoFetch } from 'expo/fetch';
import { AppState } from 'react-native';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { configureTutor, connectContent, primeAllContent } from '@matricmate/core';
import { SITE_URL } from './site';

/**
 * The Supabase client for the app. Same project, same tables, same rules as the
 * website, so an account made in either place works in both.
 *
 * Only the publishable key ever reaches a phone. An APK is a zip file that
 * anyone can open, so treat everything in this bundle as public. The key is
 * designed for that: on its own it can read and write nothing. Row Level
 * Security decides what a request may touch, based on the signed-in user, and
 * it is enforced by Postgres rather than by anything shipped here.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Whatever went wrong setting this up, or null when nothing did.
 *
 * Read by the app so it can say so on screen. Anything thrown while this module
 * is evaluating happens before React mounts, so there is no error boundary to
 * catch it and no red box: the process just disappears, which is the least
 * debuggable failure an app can have. Nothing in a client library is worth that,
 * so the whole construction is wrapped and the app is told rather than killed.
 */
export let supabaseError: string | null = null;

function build(): SupabaseClient | null {
  if (!url || !key) {
    supabaseError = 'Supabase keys are missing from this build.';
    return null;
  }
  try {
    return createClient(url, key, {
      auth: {
        /**
         * Sessions live in AsyncStorage so a student is still signed in
         * tomorrow. The refresh token is the sensitive part; it is scoped to
         * one device and revoked by signing out.
         */
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        /**
         * Web only. React Native has no URL bar for Supabase to read a token
         * out of, and leaving it on makes the client wait on a browser API that
         * never answers.
         */
        detectSessionInUrl: false,
      },
    });
  } catch (err) {
    supabaseError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error('supabase: client could not be created', err);
    return null;
  }
}

const client = build();

/** True only when there is a working client to talk to. */
export const isSupabaseConfigured = client !== null;

/**
 * A stand-in that survives any depth of chaining.
 *
 * The first version of this proxy was one level deep: supabase.auth returned a
 * function, .signInWithPassword on that function was undefined, and calling it
 * crashed with "undefined is not a function" on the login screen of a client
 * build. Which is worse than no fallback at all: it converted a configuration
 * mistake into what looks like a code bug, on the exact screen a first-time
 * user meets. This one returns itself for every property and every call, and
 * rejects with the real reason the moment anything in the chain is awaited, so
 * the student sees "Supabase keys are missing from this build" in the form
 * instead of a crash.
 */
function unusable(reason: string): SupabaseClient {
  const target = () => undefined;
  return new Proxy(target, {
    apply: () => unusable(reason),
    get: (_t, prop) => {
      if (prop === 'then') return (_res: unknown, rej: (e: Error) => void) => rej(new Error(reason));
      if (typeof prop === 'symbol') return undefined;
      return unusable(reason);
    },
  }) as unknown as SupabaseClient;
}

export const supabase: SupabaseClient =
  client ?? unusable(supabaseError ?? 'Supabase is not available in this build.');

/**
 * Point the shared content layer at this client, once, before any screen runs.
 *
 * Module scope rather than a provider on purpose: a screen can render before an
 * effect has fired, and a chapter list that flashes bundled sample content and
 * then swaps to the real thing looks like a bug. Null when Supabase is not
 * configured, which leaves the app on bundled content instead of on a client
 * that throws on every call.
 */
connectContent(client);
// Warm the synchronous lookups so chapter titles are real from the first render.
void primeAllContent(client ?? undefined);

/**
 * Point the tutor at the web app's API, which holds the AI key and enforces
 * the plan check, daily quota and rate limit server-side. The phone proves
 * who is asking with its Supabase access token; the fallback URL matches the
 * production deployment so a build without the env var still reaches it.
 */
configureTutor({
  siteUrl: SITE_URL,
  getToken: async () => {
    if (!client) return null;
    try {
      return (await client.auth.getSession()).data.session?.access_token ?? null;
    } catch {
      return null;
    }
  },
  /**
   * expo/fetch, not React Native's built-in fetch, and only here: it exposes a
   * readable response body, which is what lets a tutor answer stream in as it
   * is written instead of landing all at once.
   *
   * And `accept-encoding: identity`, which is the other half of that and took
   * far too long to find. expo/fetch quietly adds `zstd, br, gzip` to every
   * request it makes (TransparentCompressionInterceptor), Vercel answers our
   * NDJSON with Brotli, and expo decodes it through `BrotliInputStream`: a
   * blocking decoder that hands back nothing until it has a whole meta-block.
   * A tutor answer compresses to well under a kilobyte, which is one block, so
   * the entire stream arrived as a single chunk. Everything upstream was
   * streaming correctly and the last decoder in the chain undid all of it.
   *
   * The interceptor leaves the header alone when the caller has set one, and
   * skips decompression entirely when the response comes back uncompressed, so
   * asking for identity takes the decoder out of the path. It costs a kilobyte
   * or two of extra transfer per answer. Time to first token measured lower
   * without compression anyway.
   */
  fetchImpl: (url, init) =>
    expoFetch(url, {
      ...init,
      // A plain object, not a Headers instance: every caller here builds one
      // already, and it keeps this independent of how expo normalises them.
      headers: { ...((init?.headers ?? {}) as Record<string, string>), 'accept-encoding': 'identity' },
    } as Parameters<typeof expoFetch>[1]) as unknown as Promise<Response>,
});

/**
 * Refresh tokens only while the app is in front of someone.
 *
 * Supabase's timer keeps running in the background otherwise, which on Android
 * means network calls from an app nobody is looking at: battery spent for
 * nothing, and on a metered connection, data too. Told to stop on background
 * and catch up on resume, which is what the Supabase React Native guide
 * recommends and what stops a session expiring while a student is mid-chapter.
 */
if (client) {
  try {
    AppState.addEventListener('change', (status) => {
      if (status === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    });
  } catch (err) {
    console.error('supabase: could not watch app state', err);
  }
}
