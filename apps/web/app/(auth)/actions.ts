'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { safePath } from '@/lib/safe-path';
import { SITE_URL } from '@/lib/site';
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
};

const email = z.string().trim().min(1, 'Enter your email.').email('That does not look like an email address.');
const password = z.string().min(6, 'Passwords need at least 6 characters.');

const SignUp = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(80, 'That name is too long.'),
  email,
  password,
});

const SignIn = z.object({ email, password });

const first = (err: z.ZodError) => err.issues[0]?.message ?? 'Check the form and try again.';

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = SignUp.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: first(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    // Read by the on_auth_user_created trigger to seed the profile row.
    options: { data: { name: parsed.data.name } },
  });

  if (error) {
    // Supabase says "User already registered". Say something a person can act on.
    if (/already registered/i.test(error.message)) {
      return { error: 'That email already has an account. Log in instead.' };
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

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = SignIn.safeParse({ email: formData.get('email'), password: formData.get('password') });
  if (!parsed.success) return { error: first(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Deliberately does not distinguish "no such account" from "wrong password".
    // The difference tells a stranger which emails are registered here.
    return { error: 'Wrong email or password.' };
  }

  redirect(safePath(formData.get('next')));
}

export async function resetPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = email.safeParse(formData.get('email'));
  if (!parsed.success) return { error: first(parsed.error) };

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
    .refine((v) => v.password === v.confirm, { message: 'Both passwords need to match.' })
    .safeParse({ password: formData.get('password'), confirm: formData.get('confirm') });
  if (!parsed.success) return { error: first(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'That reset link has expired. Ask for a new one.' };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };

  redirect('/dashboard');
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
