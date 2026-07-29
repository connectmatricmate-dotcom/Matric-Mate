'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/**
 * Auth, validated on the server.
 *
 * The forms validate too, but that is only ever a courtesy to the person
 * typing. Anyone can POST straight at this action and skip the UI entirely, so
 * the rules below are the real ones. See the security checklist, guard 1.
 */

export type AuthState = { error?: string; sent?: boolean };

const email = z.string().trim().min(1, 'Enter your email.').email('That does not look like an email address.');
const password = z.string().min(6, 'Passwords need at least 6 characters.');

const SignUp = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(80, 'That name is too long.'),
  email,
  password,
});

const SignIn = z.object({ email, password });

const first = (err: z.ZodError) => err.issues[0]?.message ?? 'Check the form and try again.';

/**
 * Where to go after signing in.
 *
 * Only a path on this site, never a full URL: an open redirect turns our login
 * page into a convincing launchpad for someone else's.
 */
function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === 'string' ? value : '';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = SignUp.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: first(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
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

  redirect(safeNext(formData.get('next')));
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

  redirect(safeNext(formData.get('next')));
}

export async function resetPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = email.safeParse(formData.get('email'));
  if (!parsed.success) return { error: first(parsed.error) };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data);

  // Always the same answer, whether or not the account exists, for the same
  // reason as above.
  return { sent: true };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
