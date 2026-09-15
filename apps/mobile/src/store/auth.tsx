import { normaliseMobile, setQuotaUser } from '@matricmate/core';
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
  /** The one subject a free trial opens (plan 'trial'); null otherwise. */
  trialSubject: string | null;
  /** This account has had its free trial, so the offer is not shown again. */
  trialUsed: boolean;
  /**
   * Whether this account can still start the free trial, as the database
   * decides it (trial_state(), migration 0045): 'eligible' goes to the trial
   * screen when there is no plan, anything else to the paused screen. Null
   * until it has been read.
   */
  trialState: TrialState | null;
};

export type TrialState = 'eligible' | 'used' | 'no';

const NONE: Entitlement = { active: false, validTill: null, plan: null, trialSubject: null, trialUsed: false, trialState: null };

/** A timer this far ahead is not worth holding: the app is re-checked on every return to the front anyway. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Running means an end date still ahead. A row with no end date is not a
 * plan, the same reading as the database (has_active_plan, 0045) and the
 * website (planIsActive).
 */
const running = (active: unknown, till: number | null) => Boolean(active) && till !== null && till > Date.now();

/** What the server said, or the same answer worked out from the row when the call failed. */
const trialStateFrom = (fromServer: unknown, row: { plan?: string | null; trial_used_at?: string | null } | null): TrialState => {
  if (fromServer === 'eligible' || fromServer === 'used' || fromServer === 'no') return fromServer;
  if (row?.trial_used_at) return 'used';
  return row?.plan ? 'no' : 'eligible';
};

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
/** Re-reads after a failed or timed-out entitlement read with nothing cached. */
const ENTITLEMENT_RETRIES = 3;

/**
 * The same bound for the profile read (name and role), which the splash waits
 * on for a signed-in cold start. It had none, and PostgREST does not reject a
 * stalled request, so on a dead connection the app sat on its logo.
 */
const PROFILE_TIMEOUT_MS = 8000;

/**
 * The shortest gap between two quiet re-checks of the same signed-in account.
 *
 * The auth client reports the same session twice at every cold start (the
 * stored one read back, then the same one as an event) and again on every
 * token refresh. One re-read covers all of those.
 */
const SAME_USER_RECHECK_MS = 60_000;

/** How long signing out waits for unsent answers, and for the push handover, before going ahead. */
const SIGN_OUT_FLUSH_MS = 6000;
const PUSH_RELEASE_MS = 4000;

/**
 * Waits for `work`, but never longer than `ms`, and never throws. Used where
 * a stalled request would otherwise hold a student on a button that does not
 * answer; whatever was still running carries on in the background.
 */
async function settle(work: Promise<unknown>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      work.catch(() => {}),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Work that has to finish while the session still exists, registered by the
 * study store (store/app.tsx), which sits below this provider and so cannot be
 * reached from it any other way.
 *
 * It sends the answers still waiting in the offline queue. Signing out wipes
 * the phone's copy of the student's progress, and it used to do so with
 * answers given offline still unsent, while the dialog in front of it promised
 * that progress stayed saved.
 */
let beforeSignOut: (() => Promise<void>) | null = null;

export function setBeforeSignOut(work: (() => Promise<void>) | null): void {
  beforeSignOut = work;
}

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
    /*
     * The end date still counts offline. The grace window is for a plan that
     * cannot be re-checked, not for one that has ended: a cached "active" used
     * to keep a finished plan's downloads open for up to a month.
     * A cache written before the trial existed has neither trial field.
     */
    return {
      ...rest,
      active: running(rest.active, rest.validTill ?? null),
      trialSubject: rest.trialSubject ?? null,
      trialUsed: !!rest.trialUsed,
      trialState: rest.trialState ?? null,
    };
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
export type SignUpResult = {
  ok: true;
  needsConfirmation: boolean;
  /** A teacher's code was given and matched no active teacher, so nobody is linked. */
  refMissed?: boolean;
};

/**
 * A teacher's code as the website accepts it (referralCode in its sign-up
 * action): upper case, letters and digits, 4 to 16 of them. Anything else is
 * not sent, so the trigger sees no `ref` at all.
 */
export const cleanTeacherCode = (raw: string): string => raw.replace(/\s+/g, '').toUpperCase().slice(0, 16);
export const teacherCodeOk = (code: string): boolean => /^[A-Z0-9]{4,16}$/.test(code);

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
  /**
   * `school` is optional; the signup trigger copies it to the profile
   * (migration 0042). `teacherCode` too: the trigger ties the student to the
   * teacher whose active code it is (`ref`, as the website sends it).
   */
  signUp: (name: string, email: string, password: string, mobile?: string, school?: string, teacherCode?: string) => Promise<SignUpResult>;
  /** Sends the confirmation email again, for one that never arrived. */
  resendConfirmation: (email: string) => Promise<void>;
  /**
   * `deleted`: the account has just been deleted on the server, so there is
   * nothing to send first and nobody to hand the push token back for.
   */
  signOut: (opts?: { deleted?: boolean }) => Promise<void>;
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
  /** The account whose profile has been read successfully, so a failed re-read can keep it. */
  const profileReadFor = useRef<string | null>(null);
  /** When the signed-in account was last re-checked, for SAME_USER_RECHECK_MS. */
  const checkedAt = useRef(0);

  const loadEntitlement = useCallback(async function load(userId: string, attempt = 0): Promise<void> {
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
      type Row = { active: boolean | null; plan: string | null; valid_till: string | null; trial_subject: string | null; trial_used_at: string | null };
      type Read = [{ data: Row | null; error: { message: string } | null }, { data: unknown; error: unknown }];
      const [{ data, error }, trial] = await Promise.race<Read>([
        Promise.all([
          supabase
            .from('entitlements')
            .select('active, plan, valid_till, trial_subject, trial_used_at')
            .eq('user_id', userId)
            .maybeSingle(),
          // Whether the trial is still on offer, beside the row, in the same wait.
          supabase.rpc('trial_state'),
        ]) as unknown as Promise<Read>,
        new Promise<Read>((resolve) =>
          setTimeout(
            () => resolve([{ data: null, error: { message: 'timeout' } }, { data: null, error: { message: 'timeout' } }]),
            ENTITLEMENT_TIMEOUT_MS,
          ),
        ),
      ]);

      if (currentUserId.current !== userId) return;

      if (error) {
        // Offline or the server is unhappy. Fall back to what we saw last time
        // rather than telling a paying student their plan has gone.
        const cached = await readCachedEntitlement(userId);
        if (cached && currentUserId.current === userId) setEntitlement(cached);
        /*
         * And ask again, a few times, a little further apart each time. With
         * nothing cached (a first sign-in on this phone) a slow connection
         * timed out into "no plan", and a paying student sat on the upgrade
         * screen until they found "Check again". The upgrade screen sends
         * them into the app by itself the moment a later read finds the plan.
         */
        if (!cached && attempt < ENTITLEMENT_RETRIES) {
          setTimeout(() => {
            if (currentUserId.current === userId) void load(userId, attempt + 1);
          }, 3000 * (attempt + 1));
        }
        return;
      }

      const till = data?.valid_till ? Date.parse(data.valid_till) : null;
      /**
       * Expiry is decided here as well as on the server. The row can say active
       * while its date has passed, because nothing runs at midnight to flip it,
       * and a student should not keep premium because a cron job does not exist.
       */
      const next: Entitlement = {
        active: running(data?.active, till),
        validTill: till,
        plan: data?.plan ?? null,
        trialSubject: data?.trial_subject ?? null,
        trialUsed: Boolean(data?.trial_used_at),
        trialState: trialStateFrom(trial.error ? null : trial.data, data),
      };
      setEntitlement(next);
      await AsyncStorage.setItem(cacheKey(userId), JSON.stringify({ ...next, cachedAt: Date.now() }));
    } finally {
      if (currentUserId.current === userId) setEntitlementReady(true);
      setChecking(false);
    }
  }, []);

  const loadProfile = useCallback(async (userId: string) => {
    type ProfileRow = { name?: string | null; role?: string | null };
    let row = null as ProfileRow | null;
    let failed = false;
    try {
      // Raced against a timeout, for the same reason as the entitlement read.
      const { data, error } = await Promise.race([
        supabase.from('profiles').select('name,role').eq('id', userId).maybeSingle(),
        new Promise<{ data: null; error: { message: string } }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), PROFILE_TIMEOUT_MS),
        ),
      ]);
      row = data as ProfileRow | null;
      failed = Boolean(error);
    } catch {
      failed = true;
    }
    if (currentUserId.current !== userId) return;
    // A failed re-read of an account already on screen changes nothing: its
    // name and role were read a moment ago and have not stopped being true.
    if (failed && profileReadFor.current === userId) return;
    if (!failed) profileReadFor.current = userId;
    setProfileName(row?.name ?? null);
    const r = row?.role;
    setRole(r === 'affiliate' || r === 'admin' ? r : 'student');
    // Even on a failed read: the answer is then "student", the old behaviour,
    // and holding the splash forever would be worse than that default.
    setRoleReady(true);
  }, []);

  /** Applies a session change: remember who it is, then fetch what they own. */
  const adopt = useCallback(
    (next: Session | null) => {
      setSession(next);
      const id = next?.user.id ?? null;
      const sameUser = id !== null && id === currentUserId.current;
      currentUserId.current = id;
      // Whose AI count the shared quota store holds. A different account, or
      // none, empties it, and answers to requests made for the previous one
      // are refused from then on: the next student on a shared phone used to
      // inherit the last one's count, and a chat box disabled for the day.
      // The same account again changes nothing, so a token refresh is free.
      setQuotaUser(id);

      if (!id) {
        setEntitlement(NONE);
        setEntitlementReady(true);
        setProfileName(null);
        setRole('student');
        setRoleReady(false);
        profileReadFor.current = null;
        return;
      }
      /*
       * The same account again: a token refresh, which comes about hourly and
       * on every resume after a long background, or the start-up session
       * reported a second time. What this student has paid for and who they
       * are did not change with their token, so nothing is taken down while
       * it is re-checked. Dropping both ready flags here swapped all five tabs
       * for a spinner and remounted them, so every refresh threw away each
       * tab's scroll position and state and refetched everything.
       */
      if (sameUser) {
        if (Date.now() - checkedAt.current < SAME_USER_RECHECK_MS) return;
        checkedAt.current = Date.now();
        void loadEntitlement(id);
        void loadProfile(id);
        return;
      }
      checkedAt.current = Date.now();
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

  /**
   * A plan that ends while the app is open ends on screen too.
   *
   * Nothing re-read the plan at its end time, so the tabs stayed up after a
   * trial's last minute while the database had already stopped handing over
   * its content: the chapter screens filled with errors instead of locks. At
   * the end time the plan is marked ended here and read again, and the tab
   * gate moves the student to the paused screen.
   */
  useEffect(() => {
    if (!entitlement.active || !entitlement.validTill) return;
    const ms = entitlement.validTill - Date.now();
    if (ms > DAY_MS) return;
    const till = entitlement.validTill;
    const timer = setTimeout(() => {
      setEntitlement((e) => (e.validTill === till ? { ...e, active: false } : e));
      const id = currentUserId.current;
      if (id) void loadEntitlement(id);
    }, Math.max(ms, 0) + 1000);
    return () => clearTimeout(timer);
  }, [entitlement.active, entitlement.validTill, loadEntitlement]);

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
            // This phone's session only: the default signs the account out
            // everywhere, and a teacher who tried the app would lose the
            // website session they actually work in.
            await supabase.auth.signOut({ scope: 'local' });
            throw new Error('auth.errStaffApp');
          }
        }
      },

      async signUp(name, email, password, mobile, school, teacherCode) {
        const phone = mobile ? normaliseMobile(mobile) : null;
        const schoolName = (school ?? '').trim().replace(/\s+/g, ' ');
        const code = cleanTeacherCode(teacherCode ?? '');
        const ref = teacherCodeOk(code) ? code : null;
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            // Read by the on_auth_user_created trigger to seed the profile row,
            // exactly as the website does, so one account looks the same in both.
            // The number is normalised to +92 and ten digits here because that
            // is what the column takes; an unrecognised one is left out rather
            // than failing the signup.
            data: {
              name: name.trim(),
              ...(phone ? { phone } : {}),
              ...(schoolName ? { school: schoolName } : {}),
              ...(ref ? { ref } : {}),
            },
            // The link is opened in a phone browser, not in the app, so it has
            // to land on the website. They confirm there and come back to sign
            // in, which is what the "back to sign in" button here expects.
            emailRedirectTo: `${SITE}/auth/callback?next=/dashboard`,
          },
        });
        if (error) throw new Error(readable(error.message));
        /*
         * Whether the code found its teacher, so the student hears about a
         * typo now rather than never. The trigger ignores an unknown code in
         * silence, and the profile says which it was. Bounded and best
         * effort: an unanswered read says nothing either way.
         */
        let refMissed = false;
        const uid = data.session?.user.id;
        if (ref && uid) {
          const read = await Promise.race([
            supabase.from('profiles').select('referred_by').eq('id', uid).maybeSingle(),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), PROFILE_TIMEOUT_MS)),
          ]);
          refMissed = !!read && !read.error && !read.data?.referred_by;
        }
        /**
         * No session means the project is set to confirm addresses by email.
         * The account exists; it just cannot be used until the link is clicked.
         */
        return { ok: true, needsConfirmation: !data.session, refMissed };
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

      async signOut(opts) {
        // A deleted account has nothing left to send or hand back: its rows,
        // push token included, went with it.
        if (!opts?.deleted) {
          // Unsent answers first, while the session that owns them still exists.
          // Bounded, because a student on no signal must still be able to sign
          // out; what cannot be sent now stays queued under their own account
          // and goes the next time they sign in on this phone.
          if (beforeSignOut) await settle(beforeSignOut(), SIGN_OUT_FLUSH_MS);
          // Before the session goes, not after: the phone has to be handed back
          // while we can still prove who is handing it over. Otherwise the next
          // student to sign in on this device inherits the last one's push.
          // Bounded too: fetching the device token can hang with no signal.
          await settle(releasePushToken(), PUSH_RELEASE_MS);
        }
        // Read before the session goes: the sign-out event clears it on the
        // way (adopt), and read after, it was always null, so the cached plan
        // below was never removed.
        const id = currentUserId.current;
        // This phone only, as the website does: the default ends the session on
        // every device, so signing out here signed the student out of their
        // laptop too, which is not what "sign out" on one phone means.
        await supabase.auth.signOut({ scope: 'local' });
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
