import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Which of the three areas this account belongs in.
 *
 * One sign-in form, three destinations: students to `/dashboard`, teachers on
 * the referral programme to `/affiliate`, and Adnan to `/admin`. The role lives
 * on the profile row and is set by an administrator, never by the account
 * holder: there is no self-serve path to becoming an affiliate, by design, and
 * no update policy on `profiles.role` that a student's token could use.
 *
 * Read under the caller's own session, so row level security answers rather
 * than a hand-written filter, and through `React.cache` so a layout guard and
 * the page inside it cost one query between them.
 */

export type Role = 'student' | 'affiliate' | 'admin';

export const currentRole = cache(async (): Promise<Role> => {
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('role').maybeSingle();
  const role = data?.role;
  return role === 'affiliate' || role === 'admin' ? role : 'student';
});

/** Where this account goes after signing in, or after landing on `/`. */
export function homeFor(role: Role): string {
  return role === 'admin' ? '/admin' : role === 'affiliate' ? '/affiliate' : '/dashboard';
}

/**
 * Where to send somebody who has just signed in, in ONE hop.
 *
 * Sending an unpaid student to `/dashboard` and letting the app layout bounce
 * them to `/upgrade` looks equivalent and is not. A `redirect()` from a server
 * action is finished by the router on the client, and when the page it lands
 * on redirects again the router is handed a payload it does not follow: the
 * screen goes blank and stays blank until the student reloads by hand. A plain
 * refresh of the same URL answers 307 and works, which is exactly the shape of
 * the bug that was reported.
 *
 * So the decision is made once, here, before the redirect happens.
 */
export async function landingFor(role: Role): Promise<string> {
  if (role !== 'student') return homeFor(role);
  const { hasActivePlan } = await import('@/lib/entitlement');
  return (await hasActivePlan()) ? '/dashboard' : '/upgrade';
}

/**
 * A second lock on the admin door, independent of the database.
 *
 * `ADMIN_EMAILS` is a comma-separated allowlist in the environment. An account
 * needs both `role = 'admin'` and a listed address, so getting in requires
 * both a database write and a deploy. The admin panel can create accounts, set
 * what people are paid and record money as handed over; one compromised row
 * should not be enough.
 *
 * Unset means the allowlist is not enforced, which is the right behaviour for
 * a local checkout and the wrong one for production. `docs/DEPLOYMENT.md`
 * carries the note.
 */
export function emailAllowedAsAdmin(email: string | null | undefined): boolean {
  const raw = process.env.ADMIN_EMAILS?.trim();
  if (!raw) return true;
  const allowed = raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return !!email && allowed.includes(email.toLowerCase());
}

/**
 * Turn staff away from a student screen, and send them to their own.
 *
 * Called from every layout that fronts a student route. An administrator
 * reaching /dashboard was not a hypothetical: the header used to link there,
 * and Adnan landed on a price list for the product he owns, because the
 * paywall answered before anybody asked whose account it was.
 *
 * A redirect rather than a 404, because unlike the staff areas there is no
 * secret being kept here. These addresses are the app; the point is only that
 * they are not for these accounts.
 */
export async function keepStaffOut(): Promise<void> {
  const role = await currentRole();
  if (role !== 'student') redirect(homeFor(role));
}
