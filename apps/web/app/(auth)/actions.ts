'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { type StringKey, translate } from '@matricmate/core';
import { readUiLanguage } from '@/lib/ui-language.server';
import { z } from 'zod';
import { safePath } from '@/lib/safe-path';
import { SITE_URL } from '@/lib/site';
import { normaliseMobile } from '@matricmate/core';

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
  if (!parsed.success) return { error: translate(await readUiLanguage(), first(parsed.error)) };

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

  if (error) {
    // Supabase says "User already registered". Say something a person can act on.
    if (/already registered/i.test(error.message)) {
      return { error: translate(await readUiLanguage(), 'auth.errRegistered') };
    }
    return { error: error.message };
  }

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
  if (!address) return { error: translate(await readUiLanguage(), 'auth.resendConfirmFail') };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: address,
    options: { emailRedirectTo: `${SITE_URL}/auth/callback?next=/onboarding/class` },
  });
  if (error) return { error: translate(await readUiLanguage(), 'auth.resendConfirmFail') };
  return { sent: true, email: address, notice: 'auth.resendConfirmDone' };
}

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = SignIn.safeParse({ email: formData.get('email'), password: formData.get('password') });
  if (!parsed.success) return { error: translate(await readUiLanguage(), first(parsed.error)) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Deliberately does not distinguish "no such account" from "wrong password".
    // The difference tells a stranger which emails are registered here.
    //
    // Translated here rather than on the client: this is a server action, and
    // it can read the language cookie, so an Urdu student is not told their
    // password is wrong in English.
    return { error: translate(await readUiLanguage(), 'auth.errCredentials') };
  }

  /*
   * One form, three destinations. A teacher on the referral programme and an
   * administrator both have accounts in the same auth system as the students,
   * and both would hit the paywall if they were sent to /dashboard, because
   * neither has a subscription. An explicit `next` still wins, so a link into
   * a particular page keeps working.
   */
  const asked = safePath(formData.get('next'), '');
  const landing = await landingFor(await currentRole());

  /*
   * An explicit `next` wins, unless it is somewhere this account cannot go.
   *
   * The middleware writes ?next= when it turns an unauthenticated request
   * away, so the commonest value by far is /dashboard: a student follows a
   * link, gets bounced to log in, and is then sent back to a page the paywall
   * will bounce again. Honouring that blindly is how signing in ended on a
   * blank screen. When the landing decision says /upgrade, it wins.
   */
  redirect(landing === '/upgrade' ? landing : asked || landing);
}

export async function resetPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = email.safeParse(formData.get('email'));
  if (!parsed.success) return { error: translate(await readUiLanguage(), first(parsed.error)) };

  const supabase = await createClient();
  // The link has to land on /auth/callback, which is the only place that can
  // turn the one-time code into a session. Sending it straight at /reset would
  // give the student a form with no authority to save anything.
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${SITE_URL}/auth/callback?next=/reset`,
  });

  // Always the same answer, whether or not the account exists, for the same
  // reason as above.
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
  if (!parsed.success) return { error: translate(await readUiLanguage(), first(parsed.error)) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: translate(await readUiLanguage(), 'auth.errLinkExpired') };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };

  redirect('/dashboard');
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
