'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { type StringKey, translate } from '@matricmate/core';
import { Card, Icon, LinkBtn, Pill } from '@/components/ui/primitives';
import { getServerSnapshot, getSnapshot, subscribe } from '@/lib/persisted-store';
import { INCLUDED, PLANS, type PlanId, planById, rupees } from '@/lib/plans';


/**
 * Length of plan, not tier of plan. Everyone gets the same product; the only
 * choice is how far ahead you want to pay, so the card shows the per-month
 * number as well as the total.
 */
export function PlanPicker() {
  /**
   * Not useT(): that hook needs AppProvider, and /pricing renders without one.
   * The persisted store lives outside React, so reading the language straight
   * from it gives the same strings, follows the store wherever it is hydrated,
   * and falls back to English on provider-less pages instead of crashing.
   */
  const lang = useSyncExternalStore(
    subscribe,
    () => getSnapshot().settings.language,
    () => getServerSnapshot().settings.language
  );
  const t = useCallback(
    (key: StringKey, params?: Record<string, string | number>) => translate(lang, key, params),
    [lang]
  );
  const [picked, setPicked] = useState<PlanId>('quarter');

  return (
    <section className="mx-auto max-w-[1100px] px-5 pb-16">
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const on = plan.id === picked;
          return (
            <button key={plan.id} type="button" aria-pressed={on} onClick={() => setPicked(plan.id)} className="text-left">
              {/* border-2 on every state, so picking a plan swaps only the
                  colour and the content never shifts by a pixel. */}
              <Card
                border={on ? 'border-orange' : 'border-line hover:border-tealtint2'}
                className="relative flex h-full flex-col border-2 transition-colors duration-200"
              >
                {plan.popular ? (
                  <span className="absolute -top-3 right-5">
                    <Pill tone="orange">{t('checkout.popularPill')}</Pill>
                  </span>
                ) : null}

                <span className="flex items-center gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink2">{plan.name}</span>
                  {plan.saving ? <Pill tone="green">{plan.saving}</Pill> : null}
                </span>

                <span className="mt-2 block font-display text-[34px] leading-none text-ink">
                  {rupees(plan.perMonth)}
                  <span className="ml-1 align-middle text-[14px] font-normal text-ink2">{t('checkout.perMonthUnit')}</span>
                </span>
                <span className="mt-1.5 block text-[13px] text-ink2">
                  {plan.months === 1
                    ? t('checkout.billedMonthly')
                    : t('checkout.billedOnce', { price: rupees(plan.price), months: plan.months })}
                </span>
                <span className="mt-3 block text-[13px] text-ink2">{plan.note}</span>

                <span className="mt-4 flex items-center gap-2 text-[13px] font-extrabold text-teal">
                  <Icon name={on ? 'check' : 'plus'} size={15} strokeWidth={2.6} />
                  {on ? t('checkout.selected') : t('checkout.chooseLength')}
                </span>
              </Card>
            </button>
          );
        })}
      </div>

      <Card className="mt-5 flex flex-col gap-5 md:flex-row md:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-orangedark">{t('checkout.premiumIncludes')}</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {INCLUDED.map((li) => (
              <li key={li} className="flex items-start gap-2.5 text-[14px] text-ink">
                <Icon name="check" size={16} strokeWidth={2.6} className="mt-0.5 shrink-0 text-green" />
                {li}
              </li>
            ))}
          </ul>
        </div>
        <div className="shrink-0 md:w-[220px]">
          <LinkBtn
            title={t('checkout.subscribeNow', { price: rupees(planById(picked).price) })}
            href={`/checkout?plan=${picked}`}
            variant="orange"
            className="w-full"
          />
          <p className="mt-2 text-center text-[12px] text-ink3">{t('checkout.noChargeToday')}</p>
        </div>
      </Card>
    </section>
  );
}
