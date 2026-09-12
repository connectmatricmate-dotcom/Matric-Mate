import { LanguageRefresh } from '@/components/app/LanguageRefresh';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { boardChoice } from '@matricmate/core';
import { Localized } from '@/components/app/Localized';
import { SetupGate, type SetupStep } from '@/components/app/SetupGate';
import { readUiLanguage } from '@/lib/ui-language.server';
import { Shell } from '@/components/app/Shell';
import { PushLive } from '@/components/app/PushLive';
import { hasActivePlan, isOpenWithoutPlan } from '@/lib/entitlement';
import { keepStaffOut } from '@/lib/roles';
import { createClient, getUser } from '@/lib/supabase/server';
import { AppProvider } from '@/lib/store';

/**
 * The onboarding step an account stopped before, or null when its setup is
 * complete: a board, a medium and at least one subject saved. Only the first
 * missing step, so a student who has everything but their subjects answers
 * one screen, not four. A failed read answers null, because sending a student
 * back through setup on a database hiccup is worse than letting them in.
 */
async function unfinishedStep(): Promise<SetupStep | null> {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from('profiles').select('onboarding').eq('id', user.id).maybeSingle();
  if (error || !data) return null;
  const onboarding = data.onboarding as { medium?: unknown; subjects?: unknown } | null;
  if (!onboarding) return 'class';
  if (!boardChoice(onboarding)) return 'board';
  if (onboarding.medium !== 'en' && onboarding.medium !== 'ur') return 'medium';
  if (!Array.isArray(onboarding.subjects) || onboarding.subjects.length === 0) return 'subjects';
  return null;
}

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

  const [paid, unfinished] = await Promise.all([hasActivePlan(), unfinishedStep()]);

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

  /*
   * `paid` goes down to the store as its starting plan. The layout has just
   * read it, and without it every paying student opened the app on the free
   * state (every chapter locked, "no plan", a red 0/0) until the browser had
   * asked the same question again.
   */
  return (
    <Localized lang={lang}>
      <AppProvider initialLanguage={lang} initialPremium={paid}>
        <LanguageRefresh />
        <PushLive />
        <SetupGate step={unfinished} />
        <Shell>{children}</Shell>
      </AppProvider>
    </Localized>
  );
}
