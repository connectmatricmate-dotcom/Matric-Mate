import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Localized } from '@/components/app/Localized';
import { readUiLanguage } from '@/lib/ui-language.server';
import { Shell } from '@/components/app/Shell';
import { PushLive } from '@/components/app/PushLive';
// Side-effect import: connects the shared content layer to Supabase.
import '@/lib/content';
import { hasActivePlan, isOpenWithoutPlan } from '@/lib/entitlement';
import { keepStaffOut } from '@/lib/roles';
import { AppProvider } from '@/lib/store';

/** Renders once; child pages slot into it without rebuilding the nav. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const lang = await readUiLanguage();

  /**
   * The paywall, enforced on the server.
   *
   * There is no free tier any more, so every screen here needs a plan except
   * the handful that let a student manage the account they have not paid for
   * yet. Doing it in the layout rather than in each page means a new screen is
   * gated by default: forgetting to add a guard leaves it locked, which is the
   * safe direction to fail.
   *
   * Not in middleware, deliberately. Middleware runs on every prefetch, and a
   * dashboard prefetches around twenty links, so an entitlement query there
   * would multiply one database round trip by twenty for a single visit.
   */
  const pathname = (await headers()).get('x-pathname') ?? '';

  /*
   * Staff are not students and never see a student screen.
   *
   * This has to come before the paywall or the paywall answers first and gets
   * it wrong: neither a teacher nor an administrator has a subscription, so
   * "Leave admin" sent Adnan to the dashboard, the dashboard found no plan,
   * and he landed on a price list for a product he owns. Sending them to their
   * own area instead is both correct and the only answer that is not absurd.
   */
  await keepStaffOut();

  const paid = await hasActivePlan();

  if (!paid && !isOpenWithoutPlan(pathname)) redirect('/upgrade');

  /*
   * And the other direction. A student who pays has nothing to do on a sales
   * page, and landing on one reads as the app having forgotten they
   * subscribed, which is alarming right after handing over money.
   *
   * Decided here rather than in the page. Once the layout has streamed, the
   * response headers are gone and a redirect from the page below can only be
   * finished by the client, so a paying student would watch an empty shell
   * before it bounced.
   */
  if (paid && pathname === '/upgrade') redirect('/dashboard');

  return (
    <Localized lang={lang}>
      <AppProvider initialLanguage={lang}>
        <PushLive />
        <Shell>{children}</Shell>
      </AppProvider>
    </Localized>
  );
}
