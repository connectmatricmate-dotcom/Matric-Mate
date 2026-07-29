/**
 * Turns a `?next=` value into somewhere it is safe to send a browser.
 *
 * Login, sign-up and the email-link callback all take a destination from the
 * request, and all three have to be paranoid about it. An open redirect makes
 * our login page a convincing launchpad for someone else's: the URL really is
 * matricmate.pk, the padlock really is ours, and the student lands on a copy of
 * this site that keeps their password.
 *
 * A leading slash is not enough of a check. Browsers treat `//evil.com` as a
 * protocol-relative URL, and they normalise a backslash to a forward slash on
 * the way, so `/\evil.com` is the same trick wearing a hat. The second
 * character is what decides it, which is why both are refused here.
 *
 * Whitespace is refused too: a newline in a redirect target is how header
 * splitting starts.
 */
const SAME_SITE = /^\/(?![/\\])[^\s]*$/;

export function safePath(value: unknown, fallback = '/dashboard'): string {
  const next = typeof value === 'string' ? value.trim() : '';
  return SAME_SITE.test(next) ? next : fallback;
}
