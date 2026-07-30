'use client';

import { useState } from 'react';
import type { StringKey } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { buttonClasses } from '@/components/ui/styles';
import { Card, Icon } from '@/components/ui/primitives';
import { SectionTitle } from '@/components/ui/primitives';
import { useT } from '@/lib/store';

const FAQ: [StringKey, StringKey][] = [
  ['account.faq1Q', 'account.faq1A'],
  ['account.faq2Q', 'account.faq2A'],
  ['account.faq3Q', 'account.faq3A'],
  ['account.faq4Q', 'account.faq4A'],
];

const SUPPORT_EMAIL = 'help@matricmate.pk';

export function HelpView() {
  const t = useT();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Page width="focus">
      <PageHead back="/account" backLabel={t('account.title')} title={t('account.helpTitle')} />

      {/* A real address, not a button that only toasts. WhatsApp support joins
          it once the number exists; until then the screen offers nothing fake. */}
      <a href={`mailto:${SUPPORT_EMAIL}`} className={buttonClasses({ className: 'w-full' })}>
        <Icon name="mail" size={18} />
        {t('account.emailUs')}
      </a>

      <SectionTitle>{t('account.commonQuestions')}</SectionTitle>
      <div className="flex flex-col gap-2.5">
        {FAQ.map(([q, a], i) => (
          <Card key={q} flat>
            <button
              type="button"
              aria-expanded={open === i}
              onClick={() => setOpen(open === i ? null : i)}
              className="flex min-h-11 w-full items-center gap-2.5 text-left"
            >
              <span className="min-w-0 flex-1 text-[13.5px] font-extrabold leading-[1.5] text-ink">{t(q)}</span>
              <Icon name={open === i ? 'close' : 'plus'} size={16} className="shrink-0 text-ink2" />
            </button>
            {open === i ? <p className="mt-2 text-[13.5px] leading-[1.6] text-ink2">{t(a)}</p> : null}
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
