import { NextRequest, NextResponse } from 'next/server';
import { readPlansLink, signInAddress } from '@/lib/signin-link';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * The button in a plan reminder email (lib/signin-link.ts): signs the student
 * in and opens the plans page. Already signed in as that student, straight
 * there. A link that is out of date, forged, or for an account that cannot
 * sign in this way lands on sign-in, which then goes on to the plans page.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const toLogin = () => NextResponse.redirect(new URL('/login?next=/upgrade', origin));
  const userId = readPlansLink(req.nextUrl.searchParams);
  if (!userId) return toLogin();

  const { data } = await (await createClient()).auth.getUser();
  if (data.user?.id === userId) return NextResponse.redirect(new URL('/upgrade', origin));

  const address = await signInAddress(createAdminClient(), userId, '/upgrade', origin);
  return address ? NextResponse.redirect(address) : toLogin();
}
