import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { SITE_URL } from '@/lib/site';
import type { createAdminClient } from '@/lib/supabase/admin';

type Admin = ReturnType<typeof createAdminClient>;

/**
 * The button in a plan reminder email: it signs the student in on the website
 * and opens the plans page, so renewing does not start with remembering a
 * password on a phone.
 *
 * Supabase's own sign-in links are single use and expire in about an hour,
 * which is no good in an email read the next morning. So the email carries
 * this instead: a signed address, good for seven days, naming only the
 * account it was sent to. Opened, it asks Supabase for a fresh one-time
 * sign-in for that account and goes straight through it, landing on the plans
 * page. Nothing about the account can be read from it.
 *
 * It signs someone in once. The first version worked every time it was
 * opened for the whole week, so a forwarded email was a week-long way into
 * the account. Each link carries a random nonce that /go/plans claims
 * (table signin_links) before it signs anyone in.
 *
 * Sent by email only, never shown in the app: an in-app route to the plans
 * page is exactly what Google Play forbids (core/billing.ts).
 */
const LINK_DAYS = 7;

/**
 * A key of its own, derived from the cron secret the way the voice stream's
 * is. Null without the secret: then no link is made or accepted, rather than
 * one signed with a key anybody could work out.
 */
const key = () => {
  const secret = process.env.CRON_SECRET;
  return secret ? createHash('sha256').update(`plans-link:${secret}`).digest() : null;
};

/** The email's button, or null when links cannot be signed here. */
export function plansLink(userId: string): string | null {
  const k = key();
  if (!k) return null;
  const exp = Math.floor(Date.now() / 1000) + LINK_DAYS * 24 * 60 * 60;
  const nonce = randomBytes(16).toString('base64url');
  const sig = createHmac('sha256', k).update(`${userId}.${exp}.${nonce}`).digest('base64url');
  const url = new URL('/go/plans', SITE_URL);
  url.searchParams.set('u', userId);
  url.searchParams.set('e', String(exp));
  url.searchParams.set('n', nonce);
  url.searchParams.set('s', sig);
  return url.toString();
}

/** Who a plans link was made for and its nonce, or null when it is forged or out of date. */
export function readPlansLink(q: URLSearchParams): { userId: string; nonce: string } | null {
  const k = key();
  const userId = q.get('u') ?? '';
  const exp = Number(q.get('e'));
  const nonce = q.get('n') ?? '';
  const sig = q.get('s') ?? '';
  if (!k || !/^[0-9a-f-]{36}$/i.test(userId) || !/^[\w-]{16,64}$/.test(nonce) || !Number.isFinite(exp) || exp < Date.now() / 1000) return null;
  const want = createHmac('sha256', k).update(`${userId}.${exp}.${nonce}`).digest();
  const got = Buffer.from(sig, 'base64url');
  return got.length === want.length && timingSafeEqual(got, want) ? { userId, nonce } : null;
}

/** Marks a link used. False when it already was (or the claim could not be written). */
export async function claimPlansLink(admin: Admin, link: { userId: string; nonce: string }): Promise<boolean> {
  const { data, error } = await admin
    .from('signin_links')
    .upsert({ nonce: link.nonce, user_id: link.userId }, { onConflict: 'nonce', ignoreDuplicates: true })
    .select('nonce');
  return !error && !!data?.length;
}

/**
 * A one-time address that signs this student in and lands on `next`, or null
 * when one cannot be made (no email on the account, not a student). Built on
 * /auth/confirm rather than Supabase's action_link, which goes through the
 * PKCE flow and needs a verifier held by the browser that started it.
 */
export async function signInAddress(admin: Admin, userId: string, next: string, base: string = SITE_URL): Promise<string | null> {
  const [{ data: who }, { data: prof }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from('profiles').select('role').eq('id', userId).maybeSingle(),
  ]);
  const email = who?.user?.email;
  if (!email || (prof?.role && prof.role !== 'student')) return null;
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) return null;
  // On the address the student clicked (`base`), so the session cookie is set
  // on the site they go on using.
  const url = new URL('/auth/confirm', base);
  url.searchParams.set('token_hash', tokenHash);
  url.searchParams.set('type', 'magiclink');
  url.searchParams.set('next', next);
  return url.toString();
}
