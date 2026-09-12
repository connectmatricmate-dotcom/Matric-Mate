'use client';

import { UpgradeButton } from '@/components/commerce/UpgradeButton';
import { Page, Work } from '@/components/app/Page';
import { Card, Icon } from '@/components/ui/primitives';
import { THE_PLAN, rupees } from '@/lib/plans';
import { useT } from '@/lib/store';

/**
 * The only screen an account without a plan can see.
 *
 * Deliberately not a pricing page. A pricing page's job is to help you choose,
 * and there is nothing to choose any more: one plan, one price. So this states
 * the price, lists what it opens, and gives one button that goes straight to
 * Safepay. No comparison table, no second call to action, nothing else to click.
 */
export function UpgradeView() {
  const t = useT();
  const perks = ['billing.perk1', 'billing.perk2', 'billing.perk3', 'billing.perk4', 'billing.perk5'] as const;

  return (
    <Page width="focus">
      <Work className="flex flex-col gap-4">
        <Card className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orangetint text-orangedark">
            <Icon name="crown" size={26} />
          </span>

          <h1 className="mt-4 font-display text-[26px] text-ink">{t('billing.statusFree')}</h1>
          <p className="mx-auto mt-2 max-w-[420px] text-[14.5px] leading-[1.65] text-ink2 rtl:leading-[1.9]">{t('billing.freeBody')}</p>

          {/* latin: a price keeps the Latin face in an Urdu account. */}
          <p className="latin mt-6 font-display text-[38px] leading-none text-ink">{rupees(THE_PLAN.price)}</p>
          <p className="mt-1.5 text-[13.5px] font-extrabold text-ink2">{t('checkout.perMonthUnit')}</p>

          <div className="mt-6 flex justify-center">
            {/* The column's width on a phone: the wrapper has to widen with
                the button inside a centring row, or it stays content-wide. */}
            <UpgradeButton label={t('billing.premium')} variant="orange" withPrice={false} full className="w-full sm:w-auto" />
          </div>

          <p className="mt-3 text-[12.5px] leading-[1.6] text-ink2 rtl:leading-[1.9]">{t('checkout.noChargeToday')}</p>
        </Card>

        <Card>
          <p className="text-[13px] font-extrabold uppercase tracking-[0.07em] text-teal">{t('billing.whatsIncluded')}</p>
          <ul className="mt-3 flex flex-col gap-2.5">
            {perks.map((key) => (
              <li key={key} className="flex items-start gap-2.5">
                <Icon name="check" size={17} strokeWidth={2.6} className="mt-0.5 shrink-0 text-green" />
                <span className="text-[14px] leading-[1.6] text-ink rtl:leading-[1.9]">{t(key)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </Work>
    </Page>
  );
}
