/**
 * Deleting a student's own account, from the Android app.
 *
 * The website calls the same route with its session cookie. The app has no
 * cookie, so it sends the access token instead, the way it does for the AI
 * routes. The server does the deleting with its own key: a client session is
 * never allowed to remove a login account, only to ask for its own.
 */
export type DeleteAccountResult = { ok: true } | { ok: false; reason: 'offline' | 'error' };

export async function deleteAccount(siteUrl: string, accessToken: string): Promise<DeleteAccountResult> {
  const controller = new AbortController();
  // Long enough for a slow connection, short enough that the button comes back.
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(`${siteUrl}/api/account/delete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ confirm: 'DELETE' }),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, reason: 'error' };
    // The route's own `{ ok: true }`, not just a 200: a site without the
    // route answers its not-found page with 200, and the app then signed the
    // student out saying the account was deleted when nothing had been.
    const body = (await res.json().catch(() => null)) as { ok?: unknown } | null;
    return body?.ok === true ? { ok: true } : { ok: false, reason: 'error' };
  } catch {
    return { ok: false, reason: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}
