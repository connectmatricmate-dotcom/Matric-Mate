'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { AuthError } from '@supabase/supabase-js';
import { type StringKey, translate } from '@matricmate/core';
import { readUiLanguage } from '@/lib/ui-language.server';
import { z } from 'zod';
import { safePath } from '@/lib/safe-path';
import { SITE_URL } from '@/lib/site';
import { normaliseMobile } from '@matricmate/core';

import { isOpenWithoutPlan } from '@/lib/entitlement';
import { currentRole, landingFor } from '@/lib/roles';
import { createClient } from '@/lib/supabase/server';

/**
 * Auth, validated on the server.
 *
 * The forms validate too, but that is only ever a courtesy to the person
 * typing. Anyone can POST straight at this action and skip the UI entirely, so
 * the rules below are the real ones. See the security checklist, guard 1.
 */

export type AuthState = {
  error?: string;
  /**
   * When that error was produced. The forms key their banner on it, so a
   * second identical failure (the same wrong password twice, once the first
   * banner has timed out) shows again. Keyed on the message alone, it stayed
   * hidden and the button just stopped spinning.
   */
  at?: number;
  /** A link was emailed. Used by password reset, and by sign-up when the project confirms addresses. */
  sent?: boolean;
  /** Where that link went, so the page can name it rather than saying "your email". */
  email?: string;
  /** A confirmation to show above the form, as a dictionary key. */
  notice?: StringKey;
};

/*
 * The messages below are string keys, not sentences. These schemas are module
 * constants, evaluated once at import, so they cannot know who is asking. The
 * action translates the key it gets back, where the language cookie is
 * readable, and an Urdu student is told what is wrong in Urdu.
 */
const email = z.string().trim().min(1, 'auth.errEmailEmpty').email('auth.errEmailInvalid');
const password = z.string().min(6, 'auth.errWeakPassword');

const SignUp = z.object({
  name: z.string().trim().min(2, 'auth.errNameEmpty').max(80, 'auth.errNameLong'),
  email,
  password,
});

const SignIn = z.object({ email, password });

const first = (err: z.ZodError) => (err.issues[0]?.message ?? 'auth.errForm') as StringKey;

/** A failure for the form: in the student's language, and stamped so it shows every time. */
async function fail(key: StringKey): Promise<AuthState> {
  return { error: translate(await readUiLanguage(), key), at: Date.now() };
}

/**
 * A Supabase auth failure, as one of our own sentences.
 *
 * Supabase's text is English whatever the account language, and some of it is
 * written for developers ("For security purposes, you can only request this
 * after 37 seconds"). The error code is stable where the wording is not, so it
 * is matched first, then the status for rate limits. Anything unrecognised
 * gets the generic line, and its real text goes to the server log, where
 * somebody can act on it.
 */
function authErrorKey(error: AuthError, fallback: StringKey = 'auth.errGeneric'): StringKey {
  switch (error.code) {
    case 'invalid_credentials':
      return 'auth.errCredentials';
    case 'email_not_confirmed':
      return 'auth.errNotConfirmed';
    case 'user_already_exists':
    case 'email_exists':
      return 'auth.errRegistered';
    case 'weak_password':
      return 'auth.errWeakPassword';
    case 'email_address_invalid':
      return 'auth.errEmailInvalid';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'auth.errRateLimit';
  }
  if (error.status === 429) return 'auth.errRateLimit';
  if (/already registered/i.test(error.message)) return 'auth.errRegistered';
  console.error('auth error', error.code ?? error.status, error.message);
  return fallback;
}

/**
 * The referral code this signup should be attributed to, if any.
 *
 * Two places to look, because a student does not always sign up in the same
 * minute they clicked. The form field carries it when they came straight from
 * `/r/CODE`; the cookie carries it when they clicked, read the pricing page,
 * thought about it, and came back. The form wins: it is the more recent
 * intent, and a stale cookie on a shared laptop should not outrank the link
 * somebody just followed.
 *
 * Returns nothing at all when there is no code, so the trigger sees no `ref`
 * key rather than an empty one.
 */
async function referralCode(formData: FormData): Promise<{ ref?: string }> {
  const fromForm = String(formData.get('ref') ?? '').trim();
  const fromCookie = (await cookies()).get('mm_ref')?.value?.trim() ?? '';
  const code = (fromForm || fromCookie).toUpperCase().slice(0, 16);
  return /^[A-Z0-9]{4,16}$/.test(code) ? { ref: code } : {};
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = SignUp.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return fail(first(parsed.error));

  const mobile = normaliseMobile(String(formData.get('mobile') ?? ''));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      /*
       * Read by the on_auth_user_created trigger to seed the profile row, and
       * `ref` with it: the trigger looks the code up and ties this student to
       * the teacher whose link they came through, inside the same transaction
       * that creates the account. Attribution written here rather than by a
       * follow-up call is attribution that cannot be lost by somebody closing
       * the tab on the confirmation screen.
       */
      data: {
        name: parsed.data.name,
        // Normalised to +92 and ten digits, which is what the column takes and
        // what Safepay can parse. A number we do not recognise is dropped
        // rather than rejected: a mistyped mobile should not cost somebody
        // their account, and the trigger drops it again on its own side.
        ...(mobile ? { phone: mobile } : {}),
        ...(await referralCode(formData)),
      },
      /*
       * Where the confirmation link lands. Without this Supabase falls back to
       * the project's Site URL, which on a preview deployment is the wrong
       * host, so the link works locally and quietly breaks in review.
       */
      emailRedirectTo: `${SITE_URL}/auth/callback?next=/onboarding/class`,
    },
  });

  // Supabase says "User already registered", or a rate limit, in English.
  // Say something a person can act on, in their language.
  if (error) return fail(authErrorKey(error));

  /*
   * The code, if there was one, went to the trigger with this account. Left
   * in place, the cookie would credit the same teacher with the next person to
   * sign up on this browser for the rest of its thirty days: a sibling, or a
   * classmate on a shared laptop.
   */
  (await cookies()).delete('mm_ref');

  /**
   * No session means the project is set to confirm email addresses. The account
   * exists but cannot be used yet, so there is nowhere to redirect to.
   *
   * Sending them to /dashboard anyway is what this did before, and the result
   * was a bounce straight back to /login by proxy.ts with no explanation, which
   * reads exactly like the sign-up failed.
   *
   * Supabase also returns this shape for an address that is already registered,
   * deliberately, so that a stranger cannot use this form to find out who has an
   * account here. Both cases get the same answer, which is the point.
   */
  if (!data.session) return { sent: true, email: parsed.data.email };

  redirect(safePath(formData.get('next'), '/onboarding/class'));
}

/**
 * Send the confirmation email again.
 *
 * Without this a student whose first one went to spam has no way forward:
 * they cannot sign in, and signing up again answers "already registered".
 * Supabase rate limits the resend itself, so a repeated press costs nothing.
 */
export async function resendConfirmationAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const address = String(formData.get('email') ?? '').trim();
  if (!address) return fail('auth.resendConfirmFail');

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: address,
    options: { emailRedirectTo: `${SITE_URL}/auth/callback?next=/onboarding/class` },
  });
  if (error) return fail(error.status === 429 ? 'auth.errRateLimit' : 'auth.resendConfirmFail');
  return { sent: true, email: address, notice: 'auth.resendConfirmDone' };
}

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = SignIn.safeParse({ email: formData.get('email'), password: formData.get('password') });
  if (!parsed.success) return fail(first(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Deliberately does not distinguish "no such account" from "wrong password":
    // Supabase answers both with invalid_credentials, and the difference would
    // tell a stranger which emails are registered here. What it does tell
    // apart, an unconfirmed address or a rate limit, gets its own line, since
    // "wrong password" for either sends somebody round in circles.
    //
    // Translated here rather than on the client: this is a server action, and
    // it can read the language cookie, so an Urdu student is not told their
    // password is wrong in English.
    return fail(authErrorKey(error, error.status === 400 ? 'auth.errCredentials' : 'auth.errGeneric'));
  }

  /*
   * One form, three destinations. A teacher on the referral programme and an
   * administrator both have accounts in the same auth system as the students,
   * and both would hit the paywall if they were sent to /dashboard, because
   * neither has a subscription. An explicit `next` still wins, so a link into
   * a particular page keeps working.
   */
  const asked = safePath(formData.get('next'), '');
  const role = await currentRole();
  const landing = await landingFor(role);

  /*
   * An explicit `next` wins, unless it is somewhere this account cannot go.
   *
   * The middleware writes ?next= when it turns an unauthenticated request
   * away, so the commonest value by far is /dashboard: a student follows a
   * link, gets bounced to log in, and is then sent back to a page the paywall
   * will bounce again. Honouring that blindly is how signing in ended on a
   * blank screen. When the landing decision says /upgrade, it wins, except
   * for the pages the paywall leaves open (the account screens): those do not
   * bounce, and a student without a plan who followed a link to their
   * receipts or their subscription was otherwise dropped on the price list.
   *
   * Staff get the same rule for anything outside their own area. A teacher
   * or an administrator sent to /dashboard is bounced on to their own area by
   * the student layout, which is the same double redirect (see landingFor).
   */
  const allowed =
    role === 'student'
      ? landing !== '/upgrade' || isOpenWithoutPlan(asked)
      : asked === landing || asked.startsWith(`${landing}/`);
  redirect(allowed && asked ? asked : landing);
}

export async function resetPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = email.safeParse(formData.get('email'));
  if (!parsed.success) return fail(first(parsed.error));

  const supabase = await createClient();
  // The link has to land on /auth/callback, which is the only place that can
  // turn the one-time code into a session. Sending it straight at /reset would
  // give the student a form with no authority to save anything.
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${SITE_URL}/auth/callback?next=/reset`,
  });

  /*
   * The same answer whether or not the account exists, for the same reason as
   * above: Supabase does not report an unknown address, and neither do we.
   * What it does report is said plainly. A rate limit, or a mail server that
   * refused, used to come back as "Reset link sent", and the student waited
   * for an email that was never coming.
   */
  if (error && error.code !== 'user_not_found') return fail(authErrorKey(error));
  return { sent: true };
}

/**
 * Sets a new password for whoever the recovery link signed in.
 *
 * The user is read from the session, never from the form. A password reset that
 * took an email address from the request body would let anyone reset anyone's.
 */
export async function setPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: 'auth.errPasswordsMatch' })
    .safeParse({ password: formData.get('password'), confirm: formData.get('confirm') });
  if (!parsed.success) return fail(first(parsed.error));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail('auth.errLinkExpired');

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(authErrorKey(error));

  // In one hop to wherever this account lives. /dashboard sent a teacher or
  // an administrator through the student layout to be bounced again, and an
  // unpaid student through the paywall: the blank-screen double redirect
  // landingFor exists to prevent.
  redirect(await landingFor(await currentRole()));
}

export async function signOutAction() {
  const supabase = await createClient();
  /*
   * This browser only, which is what the confirm sheet promises ("removes your
   * account's data from this device"). The default scope is global: it ended
   * every session the account had, so a student who bought a plan on a family
   * laptop and logged out there was signed out of the app on their phone too.
   */
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/');
}
