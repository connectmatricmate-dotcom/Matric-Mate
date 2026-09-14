'use client';

import { useState } from 'react';
import { AI_QUOTA, daysLeft, formatDate, subjectById, subjectName, type StringKey } from '@matricmate/core';
import { UpgradeButton } from '@/components/commerce/UpgradeButton';
import { Page, Work } from '@/components/app/Page';
import { Btn } from '@/components/ui/controls';
import { Card, Icon, Pill } from '@/components/ui/primitives';
import { BASIC_PLAN, THE_PLAN, rupees, type Plan } from '@/lib/plans';
import { useApp, useLang, useT } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';

export type TrialState = 'eligible' | 'ended' | 'none';

const PERKS: Record<'basic' | 'premium', StringKey[]> = {
  basic: ['plans.basicPerk1', 'plans.basicPerk2', 'plans.basicPerk3', 'plans.basicPerk4'],
  premium: ['plans.premiumPerk1', 'plans.premiumPerk2', 'plans.premiumPerk3', 'plans.premiumPerk4'],
};

/**
 * The plans page: what an account without a plan sees, and where a student on
 * Basic or on the free trial comes to change that.
 *
 * It used to state one price and offer one button. Since 14 Sep 2026 there
 * are two plans and a free trial, so it offers them in the order a new
 * student meets them: try one subject free, then Premium (with AI, the one we
 * recommend and the default everywhere else), then Basic for families for
 * whom Rs 1,000 is the obstacle. The heading says where the student is now;
 * Premium students never land here (the layout sends them home).
 */
export function UpgradeView({ trial }: { trial: TrialState }) {
  const t = useT();
  const { lang } = useLang();
  const { derived } = useApp();
  const access = derived.access;
  const until = access.validTill ? formatDate(access.validTill, lang, { day: 'numeric', month: 'long' }) : '';
  const trialSubject = subjectName(subjectById(access.trialSubject ?? ''), lang) || access.trialSubject || '';

  const head =
    access.tier === 'trial'
      ? { icon: 'clock' as const, title: t('trial.currentTitle', { subject: trialSubject }), body: t('trial.currentBody', { subject: trialSubject, date: until }) }
      : access.tier === 'basic'
        ? { icon: 'crown' as const, title: t('plans.basicCurrentTitle'), body: t('plans.basicCurrentBody', { date: until }) }
        : { icon: 'crown' as const, title: t('billing.statusFree'), body: trial === 'ended' ? t('trial.ended') : t('billing.freeBody') };

  return (
    <Page width="focus">
      <Work className="flex flex-col gap-4">
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orangetint text-orangedark">
            <Icon name={head.icon} size={26} />
          </span>
          <h1 className="mt-4 font-display text-[26px] text-ink">{head.title}</h1>
          <p className="mx-auto mt-2 max-w-[440px] text-[14.5px] leading-[1.65] text-ink2 rtl:leading-[1.9]">{head.body}</p>
        </div>

        {trial === 'eligible' && !access.active ? <TrialOffer /> : null}

        <div className="grid gap-4 md:grid-cols-2">
          <PlanCard plan={THE_PLAN} highlight />
          <PlanCard plan={BASIC_PLAN} />
        </div>

        <p className="text-center text-[12.5px] leading-[1.6] text-ink2 rtl:leading-[1.9]">{t('checkout.noChargeToday')}</p>
      </Work>
    </Page>
  );
}

function PlanCard({ plan, highlight }: { plan: Plan; highlight?: boolean }) {
  const t = useT();
  const { derived } = useApp();
  const access = derived.access;
  const name = t(plan.ai ? 'plans.premiumName' : 'plans.basicName');
  // The plan this student is on now: Basic is the only one that can be, here.
  const current = access.tier === 'basic' && !plan.ai;
  const upgrading = access.tier === 'basic' && plan.ai;
  /* What an upgrade does to the Basic days already paid for, the same rule
     the payment applies (carriedOver in lib/payments.ts): they carry over at
     Basic's price, so half as many Premium days. */
  // The moment the page opened: close enough for a count of days, and stable
  // across renders. Counted as the checkout page counts them, so the two agree.
  const [openedAt] = useState(() => Date.now());
  const rest = upgrading ? daysLeft(access.validTill, openedAt) : 0;
  const carried = Math.floor((rest * BASIC_PLAN.perMonth) / THE_PLAN.perMonth);
  const label = current ? t('plans.renewCta', { plan: name }) : upgrading ? t('plans.upgradeCta') : t('plans.choose', { plan: name });

  return (
    <Card className={`flex flex-col ${highlight ? 'border-orange' : ''}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-[21px] text-ink">{name}</h2>
        {current ? (
          <Pill tone="green">{t('plans.current')}</Pill>
        ) : (
          <span className={`text-[12px] font-extrabold ${plan.ai ? 'text-teal' : 'text-ink3'}`}>
            {t(plan.ai ? 'plans.premiumTag' : 'plans.basicTag')}
          </span>
        )}
      </div>
      {/* latin: a price keeps the Latin face in an Urdu account. */}
      <p className="latin mt-3 font-display text-[32px] leading-none text-ink">{rupees(plan.price)}</p>
      <p className="mt-1 text-[13px] font-extrabold text-ink2">{t('checkout.perMonthUnit')}</p>
      <ul className="mt-4 flex flex-1 flex-col gap-2.5">
        {PERKS[plan.ai ? 'premium' : 'basic'].map((key) => (
          <li key={key} className="flex items-start gap-2.5">
            <Icon name="check" size={17} strokeWidth={2.6} className="mt-0.5 shrink-0 text-green" />
            <span className="text-[14px] leading-[1.6] text-ink rtl:leading-[1.9]">{t(key, { n: AI_QUOTA.premium })}</span>
          </li>
        ))}
      </ul>
      {upgrading && rest > 0 ? (
        <p className="mt-4 text-[12.5px] leading-[1.6] text-ink2 rtl:leading-[1.9]">
          {t('plans.upgradeNote', { n: rest, m: carried })}
        </p>
      ) : null}
      <div className="mt-5">
        <UpgradeButton
          plan={plan}
          label={label}
          variant={highlight ? 'orange' : 'line'}
          withPrice={false}
          icon={highlight ? 'crown' : null}
          full
          className="w-full"
        />
      </div>
    </Card>
  );
}

/**
 * Three days, one subject, once. Starts in the database (start_trial), which
 * refuses anything the offer should not have been shown for, and then the
 * whole app opens on a fresh load, which reads the new plan everywhere at once.
 */
function TrialOffer() {
  const t = useT();
  const { lang } = useLang();
  const { derived } = useApp();
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (!pick || busy) return;
    setBusy(true);
    setError(null);
    const { error: rpcError } = await createClient().rpc('start_trial', { p_subject: pick });
    if (!rpcError) {
      window.location.assign('/dashboard');
      return;
    }
    const m = rpcError.message;
    setError(
      /already used/.test(m) ? t('trial.errorUsed') : /already on a plan/.test(m) ? t('trial.errorPlan') : /paid before/.test(m) ? t('trial.errorPaid') : t('trial.errorGeneric'),
    );
    setBusy(false);
  }

  return (
    <Card className="border-teal bg-tealtint">
      <h2 className="font-display text-[21px] text-ink">{t('trial.offerTitle')}</h2>
      <p className="mt-1.5 text-[14px] leading-[1.6] text-ink2 rtl:leading-[1.9]">{t('trial.offerBody', { n: AI_QUOTA.trial })}</p>
      <p className="mt-4 text-[12px] font-extrabold uppercase tracking-[0.07em] text-teal">{t('trial.pickSubject')}</p>
      <div role="radiogroup" aria-label={t('trial.pickSubject')} className="mt-2 flex flex-wrap gap-2">
        {derived.subjects.map((sid) => (
          <button
            key={sid}
            type="button"
            role="radio"
            aria-checked={pick === sid}
            onClick={() => setPick(sid)}
            className={`min-h-11 rounded-full px-4 py-2 text-[13.5px] font-extrabold transition-colors duration-200 ${
              pick === sid ? 'bg-teal text-onbrand' : 'bg-card text-ink2 hover:brightness-95'
            }`}
          >
            {subjectName(subjectById(sid), lang) || sid}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-[12.5px] font-extrabold text-red">
          {error}
        </p>
      ) : null}
      <Btn title={t('trial.start')} onClick={() => void start()} disabled={!pick} loading={busy} className="mt-4 w-full sm:w-auto" />
    </Card>
  );
}
