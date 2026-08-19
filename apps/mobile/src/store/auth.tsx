import { normaliseMobile } from '@matricmate/core';
import type { StringKey } from '@matricmate/core';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { releasePushToken } from '../core/usePush';
import { SITE_URL } from '../lib/site';

/**
 * Who is signed in, and what they have paid for.
 *
 * This is the half of the app that is not a prototype. The account is a real
 * Supabase account, the same one the website creates, and the entitlement is
 * read from the server rather than kept on the phone. That distinction is the
 * whole architecture: the Android app is not allowed to sell anything, so the
 * only way a student can have premium here is that the server says so.
 *
 * Study progress stays local for now (see store/app.tsx). Only identity and
 * entitlement are authoritative.
 */

export type Entitlement = {
  active: boolean;
  validTill: number | null;
  plan: string | null;
};

const NONE: Entitlement = { active: false, validTill: null, plan: null };

/**
 * How long a plan we cannot re-check stays trusted.
 *
 * A student with no data for a week should not lose chapters they paid for and
 * already downloaded, so the last known entitlement is honoured offline. It
 * cannot be honoured forever, or one signed-in phone becomes a permanent
 * subscription passed around a classroom. Thirty days is the same window
 * Spotify allows, and it comfortably covers a month of no connection.
 */
const OFFLINE_GRACE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * How long the entitlement read may hang before we stop waiting on it.
 *
 * Same reasoning and the same number as hydrateStudyState in core: the moment
 * a request like this stalls is exactly the moment somebody is staring at a
 * screen that cannot decide what it is.
 */
const ENTITLEMENT_TIMEOUT_MS = 8000;

type CachedEntitlement = Entitlement & { cachedAt?: number };

/**
 * The last entitlement seen, if it is still inside the grace window.
 *
 * Returns null for a cache older than that, and for one written before this
 * function existed, which carries no timestamp: an unknown age is treated as
 * too old rather than as fresh.
 */
async function readCachedEntitlement(userId: string): Promise<Entitlement | null> {
  const raw = await AsyncStorage.getItem(cacheKey(userId));
  if (!raw) return null;
  try {
    const { cachedAt, ...rest } = JSON.parse(raw) as CachedEntitlement;
    if (!cachedAt || Date.now() - cachedAt > OFFLINE_GRACE_MS) return null;
    return rest;
  } catch {
    return null;
  }
}

export type AuthUser = { id: string; name: string; email: string };

/**
 * What a sign-up returned. `needsConfirmation` is not an error: Supabase can be
 * configured to email a confirmation link, in which case the account exists but
 * has no session yet, and telling the student "check your email" is the only
 * correct thing to do. Redirecting them into the app would land on a locked
 * screen with no explanation.
 */
export type SignUpResult = { ok: true; needsConfirmation: boolean };

type Ctx = {
  /** Null until the stored session has been read back. Nothing should route on this until it is false. */
  loading: boolean;
  /** Entitlement has been settled at least once; gates on "no plan" must wait for it. */
  entitlementReady: boolean;
  /** Student, or one of the two staff kinds whose screens live on the website. */
  role: 'student' | 'affiliate' | 'admin';
  /** The role above has actually been read for this session. Routing that treats
   *  staff differently must wait for it, or the 'student' default routes an
   *  administrator into onboarding. */
  roleReady: boolean;
  session: Session | null;
  user: AuthUser | null;
  entitlement: Entitlement;
  /** True while an entitlement refresh is in flight, for pull-to-refresh affordances. */
  checking: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string, mobile?: string) => Promise<SignUpResult>;
  /** Sends the confirmation email again, for one that never arrived. */
  resendConfirmation: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  /** Re-reads entitlement from the server. Called on resume, and by hand after paying. */
  refresh: () => Promise<void>;
  /** Saves the display name to the profile row that both apps read. */
  updateName: (name: string) => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

/**
 * Where the app sends someone to manage their account or pay.
 *
 * Never opened from inside the app. It is used only to build the link in a
 * password-reset email, which is sent by Supabase and read outside Play's
 * surface. See core/billing.ts for why that distinction matters.
 */
const SITE = SITE_URL;

/** Last known entitlement, so a paid student is not locked out on a bad connection. */
const cacheKey = (userId: string) => `mm.entitlement.${userId}`;

/**
 * Supabase's messages are written for developers. These are written for a
 * fifteen year old on a phone, and they never reveal whether an email is
 * registered, which would turn the login form into an address checker.
 */
function readable(message: string): StringKey {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'auth.errCredentials';
  if (m.includes('email not confirmed')) return 'auth.errNotConfirmed';
  if (m.includes('already registered')) return 'auth.errRegistered';
  if (m.includes('weak password') || m.includes('at least')) return 'auth.errWeakPassword';
  if (m.includes('rate limit') || m.includes('too many')) return 'auth.errRateLimit';
  if (m.includes('network') || m.includes('fetch')) return 'auth.errNetwork';
  return 'auth.errGeneric';
}

/**
 * Returns a string key, not a sentence.
 *
 * This runs in the auth store, which sits above the app store and so has no
 * language to translate with. It used to return English prose, which then went
 * straight onto the login screen of an Urdu app. Handing back the key lets the
 * screen that shows the message translate it, where the language is known.
 */
export function isAuthErrorKey(value: string): value is StringKey {
  return value.startsWith('auth.err');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  /**
   * Starts true only when there is a project to talk to. With no keys there is
   * no stored session to wait for, so the gate must not hold the splash screen
   * open forever.
   */
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlement>(NONE);
  /**
   * Whether entitlement has been settled at least once for the signed-in user.
   *
   * `loading` cannot answer this. It tracks the session, and adopt() starts the
   * entitlement fetch without awaiting it, so there is a window where a student
   * is signed in, loading is false, and entitlement is still NONE. Anything
   * that gates on "no plan" during that window punishes a paying student for
   * the network being slow, which is exactly what the tab paywall did.
   */
  const [entitlementReady, setEntitlementReady] = useState(false);
  const [checking, setChecking] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);
  /**
   * Which of the three kinds of account this is.
   *
   * The app is for students. Teachers on the referral programme and
   * administrators exist in the same auth system, have no subscription, and
   * were therefore being shown the paywall: asked to buy the product they run.
   * Their own screens are on the website; here they only need telling.
   */
  const [role, setRole] = useState<'student' | 'affiliate' | 'admin'>('student');
  const [roleReady, setRoleReady] = useState(false);

  /** Guards against a slow response from a previous user overwriting the current one. */
  const currentUserId = useRef<string | null>(null);

  const loadEntitlement = useCallback(async (userId: string) => {
    setChecking(true);
    try {
      /*
       * Raced against a timeout. Nothing here used to bound this request, and
       * postgrest does not reject on a stalled connection, so on a bad network
       * the promise simply never settled: entitlementReady stayed false, and
       * the student sat looking at a dashboard in its no-plan state for
       * minutes before it finally resolved and threw them at the paywall.
       * Giving up after eight seconds falls through to the cached value, which
       * is the same path an outright error takes.
       */
      const { data, error } = await Promise.race([
        supabase.from('entitlements').select('active, plan, valid_till').eq('user_id', userId).maybeSingle(),
        new Promise<{ data: null; error: { message: string } }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), ENTITLEMENT_TIMEOUT_MS),
        ),
      ]);

      if (currentUserId.current !== userId) return;

      if (error) {
        // Offline or the server is unhappy. Fall back to what we saw last time
        // rather than telling a paying student their plan has gone.
        const cached = await readCachedEntitlement(userId);
        if (cached && currentUserId.current === userId) setEntitlement(cached);
        return;
      }

      const till = data?.valid_till ? Date.parse(data.valid_till) : null;
      /**
       * Expiry is decided here as well as on the server. The row can say active
       * while its date has passed, because nothing runs at midnight to flip it,
       * and a student should not keep premium because a cron job does not exist.
       */
      const next: Entitlement = {
        active: Boolean(data?.active) && (till === null || till > Date.now()),
        validTill: till,
        plan: data?.plan ?? null,
      };
      setEntitlement(next);
      await AsyncStorage.setItem(cacheKey(userId), JSON.stringify({ ...next, cachedAt: Date.now() }));
    } finally {
      if (currentUserId.current === userId) setEntitlementReady(true);
      setChecking(false);
    }
  }, []);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from('profiles').select('name,role').eq('id', userId).maybeSingle();
    if (currentUserId.current === userId) {
      setProfileName(data?.name ?? null);
      const r = data?.role;
      setRole(r === 'affiliate' || r === 'admin' ? r : 'student');
      // Even on a failed read: the answer is then "student", the old behaviour,
      // and holding the splash forever would be worse than that default.
      setRoleReady(true);
    }
  }, []);

  /** Applies a session change: remember who it is, then fetch what they own. */
  const adopt = useCallback(
    (next: Session | null) => {
      setSession(next);
      const id = next?.user.id ?? null;
      currentUserId.current = id;

      if (!id) {
        setEntitlement(NONE);
        setEntitlementReady(true);
        setProfileName(null);
        setRole('student');
        setRoleReady(false);
        return;
      }
      setRoleReady(false);
      setEntitlementReady(false);
      // Cached value first so the UI is right immediately, server second. Goes
      // through the same grace check, so a stale cache cannot outlive the
      // window just because this path reads it before loadEntitlement does.
      readCachedEntitlement(id).then((cached) => {
        if (cached && currentUserId.current === id) setEntitlement(cached);
      });
      loadEntitlement(id);
      loadProfile(id);
    },
    [loadEntitlement, loadProfile]
  );

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase.auth
      .getSession()
      .then(({ data }) => adopt(data.session))
      .finally(() => setLoading(false));

    /**
     * Fires on sign in, sign out and every token refresh. Deliberately does no
     * awaiting of Supabase calls inside the callback itself: the client holds a
     * lock while this runs, and calling back into it here deadlocks. `adopt`
     * starts its fetches and returns.
     */
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      adopt(next);
    });

    return () => sub.subscription.unsubscribe();
  }, [adopt]);

  /**
   * Re-check entitlement whenever the app comes back to the front.
   *
   * This is what makes paying on the website feel connected. A student pays in
   * a browser, switches back to the app, and premium is on. Without it they
   * would have to sign out and back in, which reads like the payment failed.
   */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (status) => {
      const id = currentUserId.current;
      if (status === 'active' && id) loadEntitlement(id);
    });
    return () => sub.remove();
  }, [loadEntitlement]);

  const value = useMemo<Ctx>(() => {
    const authUser: AuthUser | null = session?.user
      ? {
          id: session.user.id,
          name:
            profileName?.trim() ||
            (session.user.user_metadata?.name as string | undefined)?.trim() ||
            session.user.email?.split('@')[0] ||
            'Student',
          email: session.user.email ?? '',
        }
      : null;

    return {
      loading,
      entitlementReady,
      role,
      roleReady,
      session,
      user: authUser,
      entitlement,
      checking,

      async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw new Error(readable(error.message));
        /*
         * Staff are turned away at the door, not after it.
         *
         * A teacher or an administrator has every screen on the website and
         * none in here, and letting the sign-in stand walked them into a
         * student's onboarding. The password was right, so the session is
         * closed again and the message says which door to use instead.
         */
        const uid = data.session?.user.id;
        if (uid) {
          const { data: prof } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle();
          if (prof?.role === 'affiliate' || prof?.role === 'admin') {
            await supabase.auth.signOut();
            throw new Error('auth.errStaffApp');
          }
        }
      },

      async signUp(name, email, password, mobile) {
        const phone = mobile ? normaliseMobile(mobile) : null;
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            // Read by the on_auth_user_created trigger to seed the profile row,
            // exactly as the website does, so one account looks the same in both.
            // The number is normalised to +92 and ten digits here because that
            // is what the column takes; an unrecognised one is left out rather
            // than failing the signup.
            data: { name: name.trim(), ...(phone ? { phone } : {}) },
            // The link is opened in a phone browser, not in the app, so it has
            // to land on the website. They confirm there and come back to sign
            // in, which is what the "back to sign in" button here expects.
            emailRedirectTo: `${SITE}/auth/callback?next=/dashboard`,
          },
        });
        if (error) throw new Error(readable(error.message));
        /**
         * No session means the project is set to confirm addresses by email.
         * The account exists; it just cannot be used until the link is clicked.
         */
        return { ok: true, needsConfirmation: !data.session };
      },

      /**
       * Send the confirmation email again.
       *
       * Without this a student whose first one went to spam, or who mistyped
       * nothing at all but simply lost it, has no way forward: they cannot
       * sign in, and signing up again returns "already registered". Supabase
       * rate limits this itself, so a repeated tap costs nothing.
       */
      async resendConfirmation(email) {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: email.trim(),
          options: { emailRedirectTo: `${SITE}/auth/callback?next=/dashboard` },
        });
        if (error) throw new Error(readable(error.message));
      },

      async signOut() {
        // Before the session goes, not after: the phone has to be handed back
        // while we can still prove who is handing it over. Otherwise the next
        // student to sign in on this device inherits the last one's push.
        await releasePushToken();
        await supabase.auth.signOut();
        const id = currentUserId.current;
        // Drop the cached entitlement with the session. Leaving it behind would
        // hand the next person to sign in on this phone somebody else's plan.
        if (id) await AsyncStorage.removeItem(cacheKey(id));
        adopt(null);
      },

      async requestPasswordReset(email) {
        // The link lands on the website, which is the only place with a form
        // that can set a password. Nothing about payment is involved.
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${SITE}/auth/callback?next=/reset`,
        });
        // A failure here is not reported back. Saying "no such account" would
        // let anyone check which emails are registered.
        if (error && !/user not found/i.test(error.message)) throw new Error(readable(error.message));
      },

      async refresh() {
        const id = currentUserId.current;
        if (id) await loadEntitlement(id);
      },

      async updateName(name) {
        const id = currentUserId.current;
        const clean = name.trim();
        if (!id || !clean) return;
        // Written to the profile row, not just to auth metadata, because that
        // row is what the website reads and what the checkout puts on a receipt.
        const { error } = await supabase.from('profiles').update({ name: clean }).eq('id', id);
        if (error) throw new Error(readable(error.message));
        setProfileName(clean);
      },
    };
  }, [loading, entitlementReady, role, roleReady, session, entitlement, checking, profileName, adopt, loadEntitlement]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): Ctx {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth must be used inside AuthProvider');
  return c;
}
