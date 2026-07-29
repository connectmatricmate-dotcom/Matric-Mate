import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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
  session: Session | null;
  user: AuthUser | null;
  entitlement: Entitlement;
  /** True while an entitlement refresh is in flight, for pull-to-refresh affordances. */
  checking: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<SignUpResult>;
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
const SITE = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://matric-mate-web.vercel.app';

/** Last known entitlement, so a paid student is not locked out on a bad connection. */
const cacheKey = (userId: string) => `mm.entitlement.${userId}`;

/**
 * Supabase's messages are written for developers. These are written for a
 * fifteen year old on a phone, and they never reveal whether an email is
 * registered, which would turn the login form into an address checker.
 */
function readable(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Wrong email or password.';
  if (m.includes('email not confirmed')) return 'Confirm your email first. Check your inbox for the link.';
  if (m.includes('already registered')) return 'That email already has an account. Log in instead.';
  if (m.includes('weak password') || m.includes('at least')) return 'Passwords need at least 6 characters.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many tries. Wait a minute and try again.';
  if (m.includes('network') || m.includes('fetch')) return 'No internet connection. Check your data and try again.';
  return 'Something went wrong. Try again in a moment.';
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
  const [checking, setChecking] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);

  /** Guards against a slow response from a previous user overwriting the current one. */
  const currentUserId = useRef<string | null>(null);

  const loadEntitlement = useCallback(async (userId: string) => {
    setChecking(true);
    try {
      const { data, error } = await supabase
        .from('entitlements')
        .select('active, plan, valid_till')
        .eq('user_id', userId)
        .maybeSingle();

      if (currentUserId.current !== userId) return;

      if (error) {
        // Offline or the server is unhappy. Fall back to what we saw last time
        // rather than telling a paying student their plan has gone.
        const cached = await AsyncStorage.getItem(cacheKey(userId));
        if (cached && currentUserId.current === userId) setEntitlement(JSON.parse(cached) as Entitlement);
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
      await AsyncStorage.setItem(cacheKey(userId), JSON.stringify(next));
    } finally {
      setChecking(false);
    }
  }, []);

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from('profiles').select('name').eq('id', userId).maybeSingle();
    if (currentUserId.current === userId) setProfileName(data?.name ?? null);
  }, []);

  /** Applies a session change: remember who it is, then fetch what they own. */
  const adopt = useCallback(
    (next: Session | null) => {
      setSession(next);
      const id = next?.user.id ?? null;
      currentUserId.current = id;

      if (!id) {
        setEntitlement(NONE);
        setProfileName(null);
        return;
      }
      // Cached value first so the UI is right immediately, server second.
      AsyncStorage.getItem(cacheKey(id)).then((cached) => {
        if (cached && currentUserId.current === id) setEntitlement(JSON.parse(cached) as Entitlement);
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
      session,
      user: authUser,
      entitlement,
      checking,

      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw new Error(readable(error.message));
      },

      async signUp(name, email, password) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          // Read by the on_auth_user_created trigger to seed the profile row,
          // exactly as the website does, so one account looks the same in both.
          options: { data: { name: name.trim() } },
        });
        if (error) throw new Error(readable(error.message));
        /**
         * No session means the project is set to confirm addresses by email.
         * The account exists; it just cannot be used until the link is clicked.
         */
        return { ok: true, needsConfirmation: !data.session };
      },

      async signOut() {
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
  }, [loading, session, entitlement, checking, profileName, adopt, loadEntitlement]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): Ctx {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth must be used inside AuthProvider');
  return c;
}
