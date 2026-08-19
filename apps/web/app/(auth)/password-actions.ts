'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/**
 * Changing your own password from inside the app.
 *
 * Shared by the admin panel and the teacher dashboard, because both kinds of
 * account are handed a password by somebody else and both need a way to stop
 * that person knowing it. Adnan types a teacher's first password into the
 * onboarding form; that is unavoidable while email is unverified, and it makes
 * this the other half of the same feature rather than a nicety.
 *
 * The current password is checked before the new one is accepted. Supabase
 * does not require it, and for a session that can create accounts and record
 * payouts that is not good enough: an unattended laptop should not be a
 * permanent account takeover. `signInWithPassword` on the same client is the
 * check, which also refreshes the session, so the change happens on a session
 * that was proved a second ago.
 */

export type PasswordState = { error?: string; ok?: string };

const Change = z
  .object({
    current: z.string().min(1, 'Enter your current password.'),
    next: z.string().min(8, 'The new password must be at least 8 characters.').max(72),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { message: 'The two new passwords do not match.' })
  .refine((v) => v.next !== v.current, { message: 'That is the password you already have.' });

export async function changePasswordAction(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const parsed = Change.safeParse({
    current: formData.get('current'),
    next: formData.get('next'),
    confirm: formData.get('confirm'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form.' };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.email) return { error: 'You are not signed in.' };

  const { error: wrong } = await supabase.auth.signInWithPassword({
    email: auth.user.email,
    password: parsed.data.current,
  });
  if (wrong) return { error: 'That is not your current password.' };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.next });
  if (error) {
    // Supabase enforces its own minimum and rejects passwords it has seen in
    // breach lists when that is switched on. Pass its wording through: it is
    // more specific than anything invented here.
    return { error: error.message };
  }

  return { ok: 'Password changed. It is in use from now on.' };
}
