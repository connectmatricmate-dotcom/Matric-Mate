'use client';

import { useState } from 'react';
import type { StringKey } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Btn } from '@/components/ui/controls';
import { Card, Icon, SectionTitle } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { useT } from '@/lib/store';

const FAQ: [StringKey, StringKey][] = [
  ['account.faq1Q', 'account.faq1A'],
  ['account.faq2Q', 'account.faq2A'],
  ['account.faq3Q', 'account.faq3A'],
  ['account.faq4Q', 'account.faq4A'],
];

export function HelpView() {
  const t = useT();
  const toast = useToast();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Page width="focus">
      <PageHead back="/account" backLabel={t('account.title')} title={t('account.helpTitle')} />

      <Btn
        title={t('account.whatsapp')}
        variant="whatsapp"
        icon="whatsapp"
        className="w-full"
        onClick={() => toast(t('account.whatsappToast'))}
      />

      <SectionTitle>{t('account.commonQuestions')}</SectionTitle>
      <div className="flex flex-col gap-2.5">
        {FAQ.map(([q, a], i) => (
          <Card key={q} flat>
            <button
              type="button"
              aria-expanded={open === i}
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center gap-2.5 text-left"
            >
              <span className="min-w-0 flex-1 text-[13.5px] font-extrabold leading-[1.5] text-ink">{t(q)}</span>
              <Icon name={open === i ? 'close' : 'plus'} size={16} className="shrink-0 text-ink3" />
            </button>
            {open === i ? <p className="mt-2 text-[13.5px] leading-[1.6] text-ink2">{t(a)}</p> : null}
          </Card>
        ))}
      </div>

      <SectionTitle>{t('account.stillStuck')}</SectionTitle>
      <Btn title={t('account.reportProblem')} variant="line" className="w-full" onClick={() => toast(t('account.reportToast'))} />

      <p className="mt-4 text-[13px] text-ink2">{t('account.replyTime')}</p>
    </Page>
  );
}
