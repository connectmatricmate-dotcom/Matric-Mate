import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * A teacher's referral link: matricmate.com.pk/r/MMG72UJ9
 *
 * A route handler rather than a page, because the honest answer to this URL is
 * a redirect, and a page that renders and then bounces shows a flash of
 * nothing first.
 *
 * The code is carried two ways on purpose. In the query string, so the signup
 * form can pass it straight through; and in a cookie, because a student who
 * clicks the link, reads the pricing page, thinks about it and signs up twenty
 * minutes later should still be attributed. Thirty days is longer than anybody
 * deliberates and short enough that a shared laptop does not credit the wrong
 * teacher months later.
 *
 * On a phone this cannot open the Android app yet, and that is not an
 * oversight. The app declares a custom scheme and nothing else: no intent
 * filters, no assetlinks.json, and it is not on Play. Real App Links need the
 * domain verified, a native config change and a fresh APK, none of which is
 * available over the air. Until then the link works everywhere as a web
 * signup, which is where a student has to end up anyway, since the website is
 * the only place a subscription can be bought.
 */

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code: raw } = await ctx.params;
  const code = raw.trim().toUpperCase().slice(0, 16);

  /*
   * Check the code before honouring it. An unknown or switched-off code sends
   * the visitor to a plain signup with no cookie, rather than setting one that
   * the trigger will silently ignore later: a link that half works is harder
   * to diagnose than one that does not.
   */
  let known = false;
  try {
    const { data } = await createAdminClient()
      .from('affiliates')
      .select('code')
      .eq('code', code)
      .eq('active', true)
      .maybeSingle();
    known = !!data;
  } catch {
    // The database being down is not a reason to lose the visitor. Send them
    // to signup with the code in the URL; the trigger checks it again anyway.
    known = true;
  }

  const url = new URL(known ? `/signup?ref=${encodeURIComponent(code)}` : '/signup', req.url);
  const res = NextResponse.redirect(url);

  if (known) {
    res.cookies.set('mm_ref', code, {
      maxAge: THIRTY_DAYS,
      httpOnly: false, // read by the signup form on the client as a fallback
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
  }

  return res;
}
