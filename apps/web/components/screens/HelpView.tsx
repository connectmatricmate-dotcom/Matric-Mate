'use client';

import { useState } from 'react';
import { AI_QUOTA, BUSINESS, SUPPORT_EMAIL, type StringKey } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { buttonClasses } from '@/components/ui/styles';
import { Card, Icon } from '@/components/ui/primitives';
import { SectionTitle } from '@/components/ui/primitives';
import { useT } from '@/lib/store';

/** The published support line, as a number a phone can dial and WhatsApp can open. */
const DIGITS = `92${BUSINESS.phone.replace(/\D/g, '').replace(/^0/, '')}`;

/*
 * The website's own answers. The shared ones are written for the Android app:
 * here they told a student already on the website to go and renew on the
 * website, and promised downloads it does not offer. How to renew depends on
 * whether paying online has opened (the page says which), and the AI limit is
 * the student's plan's, not fifty for everyone.
 */
const faq = (online: boolean): [StringKey, StringKey][] => [
  ['account.faq1Q', online ? 'account.faq1AWeb' : 'account.faq1AWebManual'],
  ['account.faq2Q', 'account.faq2AWeb'],
  ['account.faq3Q', 'account.faq3APlans'],
  ['account.faq4Q', 'account.faq4A'],
];

export function HelpView({ online }: { online: boolean }) {
  const t = useT();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Page width="focus">
      <PageHead back="/account" backLabel={t('account.title')} title={t('account.helpTitle')} />

      {/* Three direct ways to a person: write, call, or WhatsApp. A student who
          does not use email had nothing to press here. */}
      <div className="flex flex-col gap-2.5">
        <a href={`mailto:${SUPPORT_EMAIL}`} className={buttonClasses({ className: 'w-full' })}>
          <Icon name="mail" size={18} />
          {t('account.emailUs', { email: SUPPORT_EMAIL })}
        </a>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <a href={`tel:+${DIGITS}`} className={buttonClasses({ variant: 'line', className: 'w-full' })}>
            <Icon name="phone" size={18} />
            {t('activation.call', { phone: BUSINESS.phone })}
          </a>
          <a
            href={`https://wa.me/${DIGITS}`}
            target="_blank"
            rel="noopener noreferrer"
            // The line style, not WhatsApp's own green: a white label on it is
            // 2:1, too faint to read in daylight.
            className={buttonClasses({ variant: 'line', className: 'w-full' })}
          >
            <Icon name="whatsapp" size={18} />
            {t('account.whatsappUs')}
          </a>
        </div>
        <p className="text-[12.5px] text-ink2">{t('activation.hours', { hours: BUSINESS.hours })}</p>
      </div>

      <SectionTitle>{t('account.commonQuestions')}</SectionTitle>
      <div className="flex flex-col gap-2.5">
        {faq(online).map(([q, a], i) => (
          <Card key={q} flat>
            <button
              type="button"
              aria-expanded={open === i}
              onClick={() => setOpen(open === i ? null : i)}
              className="group flex min-h-11 w-full items-center gap-2.5 text-start"
            >
              <span className="min-w-0 flex-1 text-[13.5px] font-extrabold leading-[1.5] text-ink transition-colors duration-200 group-hover:text-teal rtl:leading-[1.9]">
                {t(q)}
              </span>
              <Icon name={open === i ? 'close' : 'plus'} size={16} className="shrink-0 text-ink2" />
            </button>
            {open === i ? (
              <p className="mt-2 text-[13.5px] leading-[1.6] text-ink2 rtl:leading-[1.9]">
                {t(a, { premium: AI_QUOTA.premium, trial: AI_QUOTA.trial })}
              </p>
            ) : null}
          </Card>
        ))}
      </div>

      <SectionTitle>{t('account.stillStuck')}</SectionTitle>
      <a
        href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('MatricMate: problem report')}`}
        className={buttonClasses({ variant: 'line', className: 'w-full' })}
      >
        <Icon name="alert" size={18} />
        {t('account.reportProblem')}
      </a>

      <p className="mt-4 text-[13px] text-ink2">{t('account.replyTime')}</p>
    </Page>
  );
}
