import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Signed-in students only. Everything else is public or handles its own state. */
// '/r' is deliberately absent: a teacher's referral link has to work for
// somebody who has never signed in, which is the entire point of it.
const PROTECTED = ['/dashboard', '/upgrade', '/study', '/practice', '/tutor', '/progress', '/learn', '/session', '/insights', '/account', '/notifications', '/checkout', '/certificates', '/onboarding', '/admin', '/affiliate'];

/** Already signed in? These two have nothing left to offer you. */
const AUTH_ONLY = ['/login', '/signup'];

/**
 * Inside a protected branch, but public anyway.
 *
 * The payment gateway sends the payer here from its own domain, and a
 * cross-site arrival cannot be relied on to carry a session cookie: SameSite
 * Lax sends one on a top-level GET and withholds it on a POST, and which of
 * those we get depends on a branch of the gateway's checkout we do not control.
 * Guarding this path means a student who has just paid can land on the login
 * screen, which is the worst possible moment to ask them to prove who they are.
 *
 * Safe to leave open because it decides nothing. It reads two query parameters
 * and redirects to /checkout/success, which is protected, is reached by a
 * same-site navigation that does carry the cookie, and reads the payment row
 * under RLS.
 */
const PUBLIC_INSIDE_PROTECTED = ['/checkout/return'];

/**
 * How long the auth server gets before we stop waiting. Without a limit, a
 * paused Supabase project or a bad network turns every navigation into an
 * indefinite hang; the fetch has no timeout of its own.
 */
const AUTH_TIMEOUT_MS = 5000;

/**
 * Runs via proxy.ts, but only on the routes that need a session decision.
 *
 * Two jobs. It refreshes the auth token, which has to happen here because a
 * Server Component cannot set a cookie, and without it sessions expire and the
 * app starts behaving strangely for no visible reason. And it turns away
 * unauthenticated requests to protected routes before a page renders, so a
 * paywalled screen never flashes its contents on the way to the login page.
 *
 * What it deliberately does NOT do any more: call the auth server for every
 * request. A dashboard visit prefetches ~20 links and every prefetch runs this
 * function, so an unconditional getUser() multiplied one round trip (measured
 * 110 to 360ms) by twenty. Now a request with no auth cookie is decided
 * locally, and the network is only consulted when a cookie exists and the
 * route actually needs to know who is asking.
 */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /**
   * The path, forwarded to the render.
   *
   * A Server Component layout is not told which URL it is rendering, and the
   * paywall guard has to know: the same layout wraps both the screens that
   * need a plan and the account screens that must stay reachable without one.
   * Middleware is the only place that sees the path before the page renders.
   */
  const withPath = new Headers(request.headers);
  withPath.set('x-pathname', pathname);
  const requestWithPath = { headers: withPath };

  let response = NextResponse.next({ request: requestWithPath });
  const starts = (list: string[]) => list.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const isProtected = starts(PROTECTED) && !starts(PUBLIC_INSIDE_PROTECTED);
  const isAuthOnly = starts(AUTH_ONLY);

  // Public pages make no session decision. The browser client keeps its own
  // token fresh for signed-in visitors browsing the marketing pages.
  if (!isProtected && !isAuthOnly) return response;

  // No cookie means no session, and asking the auth server cannot change that.
  // Decide locally: protected routes bounce to login, login/signup render.
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'));
  if (!hasAuthCookie) {
    if (isProtected) {
      const login = request.nextUrl.clone();
      login.pathname = '/login';
      // Come back to where they were headed once they are in.
      login.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
      return NextResponse.redirect(login);
    }
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(AUTH_TIMEOUT_MS) }),
      },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: requestWithPath });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // Must be getUser(), not getSession(): this call is what refreshes the token,
  // and it is the only one that validates the cookie rather than trusting it.
  let user = null;
  let authRejected = false;
  try {
    const { data, error } = await supabase.auth.getUser();
    user = data.user;
    // A definite "no" from the auth server (expired refresh token, revoked
    // session) is a sign-out. A network failure or timeout is not; error.status
    // is absent or 0 in that case and we fail open below.
    authRejected = !user && !!error && typeof error.status === 'number' && error.status >= 400;
  } catch {
    // Timeout or transport failure. Fail open rather than hang or lock out:
    // every screen's data still sits behind RLS, so an unauthenticated pass
    // through the shell reveals nothing. The alternative, waiting forever,
    // is the "app frozen for minutes" bug.
    return response;
  }

  if (!user && isProtected && authRejected) {
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    login.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(login);
  }

  if (user && isAuthOnly) {
    const home = request.nextUrl.clone();
    home.pathname = '/dashboard';
    home.search = '';
    return NextResponse.redirect(home);
  }

  return response;
}
