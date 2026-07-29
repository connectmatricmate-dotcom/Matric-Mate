/**
 * Must be the first import in this file, and this file is imported before any
 * Supabase code runs.
 *
 * React Native ships its own URL class, a string-concatenation stand-in with
 * getter-only properties. `createClient` builds the realtime endpoint by
 * assigning `url.protocol = 'wss'`, which on that class throws "Cannot set
 * property protocol of [object Object] which has only a getter". Because the
 * client is created while this module is evaluating, the throw happens before
 * anything renders and the app closes on launch with no error screen: exactly
 * the symptom, and impossible to diagnose from inside the app.
 *
 * The polyfill replaces the global with a spec-compliant implementation that
 * has the setters. It is what Supabase's own React Native guide requires.
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';

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

/** Without keys the app still runs, it just cannot sign anyone in. */
export const isSupabaseConfigured = Boolean(url && key);

/**
 * Built once, and never allowed to throw during module evaluation.
 *
 * Anything that fails here kills the app before React mounts, which is a blank
 * close rather than an error, so it is worth the belt as well as the braces.
 */
export const supabase = createClient(url ?? 'https://placeholder.supabase.co', key ?? 'public-anon-key', {
  auth: {
    /**
     * Sessions live in AsyncStorage so a student is still signed in tomorrow.
     * The refresh token is the sensitive part; it is scoped to one device and
     * revoked by signing out.
     */
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    /**
     * Web only. React Native has no URL bar for Supabase to read a token out
     * of, and leaving it on makes the client wait on a browser API that never
     * answers.
     */
    detectSessionInUrl: false,
  },
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
if (isSupabaseConfigured) {
  AppState.addEventListener('change', (status) => {
    if (status === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
