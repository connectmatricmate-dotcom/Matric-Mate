'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { type StringKey, translate } from '@matricmate/core';
import { Card, Icon, LinkBtn } from '@/components/ui/primitives';
import { getServerSnapshot, getSnapshot, subscribe } from '@/lib/persisted-store';
import { INCLUDED, THE_PLAN, rupees } from '@/lib/plans';


/**
 * The plan, on the pricing page. One product, one price, so there is nothing
 * to pick: this used to be three cards and a selection state, which asked a
 * student to do arithmetic before they could buy anything.
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
  return (
    <section className="mx-auto max-w-[720px] px-5 pb-16">
      <Card className="flex flex-col gap-6 border-2 border-orange md:flex-row md:items-center">
        <div className="shrink-0 text-center md:w-[210px] md:text-start">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink2">{THE_PLAN.name}</p>
          <p className="mt-2 font-display text-[40px] leading-none text-ink">
            {rupees(THE_PLAN.price)}
          </p>
          <p className="mt-1 text-[14px] text-ink2">{t('checkout.perMonthUnit')}</p>
          <p className="mt-3 text-[13px] leading-[1.6] text-ink2">{THE_PLAN.note}</p>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-orangedark">{t('checkout.premiumIncludes')}</p>
          <ul className="mt-3 grid gap-2">
            {INCLUDED.map((li) => (
              <li key={li} className="flex items-start gap-2.5 text-[14px] text-ink">
                <Icon name="check" size={16} strokeWidth={2.6} className="mt-0.5 shrink-0 text-green" />
                {li}
              </li>
            ))}
          </ul>

          <LinkBtn
            title={t('checkout.subscribeNow', { price: rupees(THE_PLAN.price) })}
            href="/checkout"
            variant="orange"
            className="mt-5 w-full"
          />
          <p className="mt-2 text-center text-[12px] text-ink3">{t('checkout.noChargeToday')}</p>
        </div>
      </Card>
    </section>
  );
}
