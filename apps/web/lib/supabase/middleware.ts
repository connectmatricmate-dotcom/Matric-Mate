import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Signed-in students only. Everything else is public or handles its own state. */
const PROTECTED = ['/dashboard', '/study', '/practice', '/tutor', '/progress', '/learn', '/session', '/insights', '/account', '/notifications', '/checkout'];

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
 * Runs on every request via proxy.ts.
 *
 * Two jobs. It refreshes the auth token, which has to happen here because a
 * Server Component cannot set a cookie, and without it sessions expire and the
 * app starts behaving strangely for no visible reason. And it turns away
 * unauthenticated requests to protected routes before a page renders, so a
 * paywalled screen never flashes its contents on the way to the login page.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // Must be getUser(), not getSession(): this call is what refreshes the token,
  // and it is the only one that validates the cookie rather than trusting it.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const starts = (list: string[]) => list.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && starts(PROTECTED) && !starts(PUBLIC_INSIDE_PROTECTED)) {
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    // Come back to where they were headed once they are in.
    login.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(login);
  }

  if (user && starts(AUTH_ONLY)) {
    const home = request.nextUrl.clone();
    home.pathname = '/dashboard';
    home.search = '';
    return NextResponse.redirect(home);
  }

  return response;
}
