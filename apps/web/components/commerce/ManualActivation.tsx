'use client';

import { BUSINESS, SUPPORT_EMAIL } from '@matricmate/core';
import { Card, Icon } from '@/components/ui/primitives';
import { planName, type Plan } from '@/lib/plans';
import { useApp, useLang, useT } from '@/lib/store';

/**
 * How to get a plan while plans are switched on by hand.
 *
 * No payment gateway is live (see onlinePayments in lib/gateway): the client
 * activates plans himself from the admin dashboard. So instead of a checkout
 * that goes nowhere, every plan button ends here, with the three steps and
 * the two ways to reach the team. The email is written for them, naming the
 * account and the plan, so nothing has to be typed or remembered.
 */
export function ManualActivation({ plan }: { plan: Plan }) {
  const t = useT();
  const { lang } = useLang();
  const { state } = useApp();
  const email = state.user?.contact ?? '';
  // In English whatever the app language: it is written for the team to act on.
  const name = planName(plan.id, 'en');
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t('activation.mailSubject', { plan: name, email }))}&body=${encodeURIComponent(
    t('activation.mailBody', { plan: name, email }),
  )}`;
  const tel = `tel:${BUSINESS.phone.replace(/\s+/g, '')}`;

  return (
    <Card flat tint="bg-tealtint" border="border-tealtint2">
      <p className="font-display text-[18px] text-ink">{t('activation.title', { plan: planName(plan.id, lang) })}</p>
      <ol className="mt-3 flex flex-col gap-2">
        {(['activation.step1', 'activation.step2', 'activation.step3'] as const).map((key, i) => (
          <li key={key} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal text-[11px] font-extrabold text-onbrand">
              {i + 1}
            </span>
            <span className="text-[13.5px] leading-[1.6] text-ink rtl:leading-[1.9]">{t(key)}</span>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <a
          href={mailto}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-teal px-4 text-[13.5px] font-extrabold text-onbrand transition-[filter] duration-200 hover:brightness-110"
        >
          <Icon name="mail" size={16} />
          {t('activation.email')}
        </a>
        <a
          href={tel}
          className="latin inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-teal px-4 text-[13.5px] font-extrabold text-teal transition-colors duration-200 hover:bg-card"
        >
          <Icon name="phone" size={16} />
          {t('activation.call', { phone: BUSINESS.phone })}
        </a>
      </div>
      <p className="mt-2.5 text-[12.5px] text-ink2">{t('activation.hours', { hours: BUSINESS.hours })}</p>
    </Card>
  );
}
