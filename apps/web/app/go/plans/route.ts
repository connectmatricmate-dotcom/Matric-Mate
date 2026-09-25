import { NextRequest, NextResponse } from 'next/server';
import { claimPlansLink, readPlansLink, signInAddress } from '@/lib/signin-link';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * The button in a plan email (lib/signin-link.ts): signs the student in and
 * opens the plans page, in one tap. Already signed in as that student, straight
 * there. A link that is out of date, forged, already used, or for an account
 * that cannot sign in this way lands on sign-in, which then goes on to the
 * plans page.
 *
 * Opening the link only shows a page that carries on by itself; the link is
 * used up by that second step, a POST. Mail providers and phone security apps
 * open links in emails to check them before anyone taps, and a link that
 * signed in (and so used itself up) on a GET was spent by that check: the
 * student's own tap then met a sign-in form, which is the one thing this
 * button exists to spare them. Those checkers fetch pages; they do not run
 * the script or submit the form.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const link = readPlansLink(req.nextUrl.searchParams);
  if (!link) return NextResponse.redirect(new URL('/login?next=/upgrade', origin));

  const { data } = await (await createClient()).auth.getUser();
  if (data.user?.id === link.userId) return NextResponse.redirect(new URL('/upgrade', origin));

  const action = `/go/plans?${req.nextUrl.searchParams.toString()}`.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<meta name="robots" content="noindex"><title>Opening your plans · MatricMate</title></head>` +
      `<body style="margin:0;background:#FAFBF7;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0F3D4C">` +
      `<main style="max-width:420px;margin:18vh auto;padding:0 24px;text-align:center">` +
      `<p style="font-size:17px;font-weight:700;margin:0 0 18px">Opening your plans…</p>` +
      `<form method="post" action="${action}">` +
      `<button type="submit" style="font:inherit;font-weight:800;background:#087598;color:#fff;border:0;border-radius:12px;padding:12px 22px;cursor:pointer">Continue</button>` +
      `</form></main>` +
      `<script>document.forms[0].submit()</script></body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } },
  );
}

export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  // 303: the browser follows with a GET, as a redirect after a form should.
  const toLogin = () => NextResponse.redirect(new URL('/login?next=/upgrade', origin), 303);
  const link = readPlansLink(req.nextUrl.searchParams);
  if (!link) return toLogin();

  const { data } = await (await createClient()).auth.getUser();
  if (data.user?.id === link.userId) return NextResponse.redirect(new URL('/upgrade', origin), 303);

  // Signs someone in once: a second tap on the same email goes to sign-in.
  const admin = createAdminClient();
  if (!(await claimPlansLink(admin, link))) return toLogin();
  const address = await signInAddress(admin, link.userId, '/upgrade', origin);
  return address ? NextResponse.redirect(address, 303) : toLogin();
}
