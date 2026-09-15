import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { SITE_URL } from '@/lib/site';

/**
 * The "stop these emails" link in every email, and the List-Unsubscribe
 * header mail apps turn into their own unsubscribe button.
 *
 * The footer used to say "turn these off in Profile, under Notifications",
 * which means signing in to stop an email. This is one tap: a signed address
 * naming only the account, which switches its email channel off (the same
 * switch as the setting) and says so. It does not expire: an old email's
 * link should still work, and it can do nothing but switch email off.
 */
const key = () => {
  const secret = process.env.CRON_SECRET;
  return secret ? createHash('sha256').update(`unsubscribe:${secret}`).digest() : null;
};

export function unsubscribeLink(userId: string, lang: 'en' | 'ur' = 'en'): string | null {
  const k = key();
  if (!k) return null;
  const url = new URL('/unsubscribe', SITE_URL);
  url.searchParams.set('u', userId);
  // The page answers in the language the email was written in.
  if (lang === 'ur') url.searchParams.set('l', 'ur');
  url.searchParams.set('s', createHmac('sha256', k).update(userId).digest('base64url'));
  return url.toString();
}

/** The account an unsubscribe link was made for, or null when it is not one of ours. */
export function readUnsubscribe(q: URLSearchParams): string | null {
  const k = key();
  const userId = q.get('u') ?? '';
  const sig = q.get('s') ?? '';
  if (!k || !/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const want = createHmac('sha256', k).update(userId).digest();
  const got = Buffer.from(sig, 'base64url');
  return got.length === want.length && timingSafeEqual(got, want) ? userId : null;
}
