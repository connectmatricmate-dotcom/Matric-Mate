import Link from 'next/link';
import { type StringKey, translate } from '@matricmate/core';
import { Card, Icon, LinkBtn } from '@/components/ui/primitives';
import { BASIC_INCLUDED, BASIC_PLAN, PREMIUM_INCLUDED, THE_PLAN, rupees, type Plan } from '@/lib/plans';

/**
 * The marketing pages are written in English and render outside <Localized>,
 * so nothing here sets `lang` or `dir`. This used to read the stored UI
 * language instead, and an Urdu account got Urdu lines in a Latin face, left
 * to right, between the English plan copy. English, like the page around it.
 */
const t = (key: StringKey, params?: Record<string, string | number>) => translate('en', key, params);

/**
 * The two plans, on the pricing page, side by side.
 *
 * This used to be three lengths and a selection state, then one card. Since
 * 14 Sep 2026 there are two plans that differ in one thing, the AI, so they
 * sit next to each other with Premium first and marked: it is the plan most
 * of the product's story is about. The free trial is a line under both, not a
 * third card: it is how a student tries either, not a plan to compare.
 */
export function PlanPicker() {
  return (
    <section className="mx-auto max-w-[900px] px-5 pb-16">
      <div className="grid gap-4 md:grid-cols-2">
        <PlanCard plan={THE_PLAN} items={PREMIUM_INCLUDED} tag="With the AI tutor" highlight />
        <PlanCard plan={BASIC_PLAN} items={BASIC_INCLUDED} tag="Without AI" />
      </div>
      <p className="mt-5 text-center text-[14px] leading-[1.6] text-ink2">
        Not sure yet?{' '}
        <Link href="/signup" className="font-extrabold text-teal hover:underline">
          Make an account
        </Link>{' '}
        and try one subject free for three days. No payment, nothing to cancel.
      </p>
    </section>
  );
}

function PlanCard({ plan, items, tag, highlight }: { plan: Plan; items: string[]; tag: string; highlight?: boolean }) {
  return (
    <Card className={`flex flex-col ${highlight ? 'border-2 border-orange' : ''}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-[22px] text-ink">{plan.name}</p>
        <span className={`text-[12.5px] font-extrabold ${highlight ? 'text-orangedark' : 'text-ink3'}`}>{tag}</span>
      </div>
      <p className="mt-3 font-display text-[40px] leading-none text-ink">
        {rupees(plan.price)}
        <span className="ms-1 text-[15px] font-normal text-ink2">{t('checkout.perMonthUnit')}</span>
      </p>
      <p className="mt-2 text-[13.5px] leading-[1.6] text-ink2">{plan.note}</p>
      <ul className="mt-4 flex flex-1 flex-col gap-2">
        {items.map((li) => (
          <li key={li} className="flex items-start gap-2.5 text-[14px] text-ink">
            <Icon name="check" size={16} strokeWidth={2.6} className="mt-0.5 shrink-0 text-green" />
            {li}
          </li>
        ))}
      </ul>
      <LinkBtn
        title={`Get ${plan.name} · ${rupees(plan.price)}`}
        href={`/checkout?plan=${plan.id}`}
        variant={highlight ? 'orange' : 'line'}
        className="mt-5 w-full"
      />
      <p className="mt-2 text-center text-[12px] text-ink3">{t('checkout.noChargeToday')}</p>
    </Card>
  );
}
