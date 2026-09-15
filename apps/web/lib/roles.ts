import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
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
  // Setup first: the trial is picked from the subjects chosen there.
  const { unfinishedStep } = await import('@/lib/setup');
  const step = await unfinishedStep();
  if (step) return `/onboarding/${step}`;
  const { hasActivePlan } = await import('@/lib/entitlement');
  // hasActivePlan throws when the entitlement read fails rather than calling
  // the student unpaid. Signing in should not end on an error page for that:
  // send them to the dashboard, where the (app) layout asks again and shows
  // its own error with a retry if the database is still not answering.
  try {
    if (await hasActivePlan()) return '/dashboard';
  } catch {
    return '/dashboard';
  }
  // No plan: a new account starts its free trial, anyone else goes to the plans.
  const { data } = await (await createClient()).rpc('trial_state');
  return data === 'eligible' ? '/trial' : '/upgrade';
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
 * Unset means the allowlist is not enforced on a local checkout, and shut in
 * a production build: a deploy that lost the variable must lock the panel,
 * not open it to any account that says it is an admin.
 */
export function emailAllowedAsAdmin(email: string | null | undefined): boolean {
  const raw = process.env.ADMIN_EMAILS?.trim();
  if (!raw) return process.env.NODE_ENV !== 'production';
  const allowed = raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return !!email && allowed.includes(email.toLowerCase());
}

/**
 * The admin door, checked again where the data is read.
 *
 * The (admin) layout already turns everyone else away, and that is not
 * enough on its own: Next renders a layout and the page under it at the same
 * time, so the page's service-key reads ran for a student too and its output
 * was streamed out with the 404. A signed-in student asking for /admin was
 * sent the revenue figures, and /admin/teachers sent every teacher's email
 * address and earnings. Every admin page calls this before it reads anything,
 * and so does every reader that uses the service key for the admin area.
 *
 * Same two locks as the layout, and the same answer: not found, never a hint
 * that the address means anything. `React.cache`, so a page and the readers
 * under it cost one check between them.
 */
export const requireAdmin = cache(async (): Promise<void> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  if ((await currentRole()) !== 'admin' || !emailAllowedAsAdmin(data.user.email)) notFound();
});

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
