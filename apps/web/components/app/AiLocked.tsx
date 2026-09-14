'use client';

import type { StringKey } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Card, Icon, LinkBtn } from '@/components/ui/primitives';
import { useT } from '@/lib/store';

/**
 * What an AI screen shows on the Basic plan, in place of the screen.
 *
 * Basic (Rs 500) is everything except AI, so the tutor, AI tests, mock papers
 * and revision sheets are not broken for these students, they are simply not
 * in the plan. The server refuses them regardless (lib/ai/guard.ts); this is
 * the screen saying so before the student types a question and gets a refusal.
 * One place to go from here, the plans page, where Premium is laid out
 * against the plan they have.
 */
export function AiLocked({ titleKey, back, backLabelKey }: { titleKey: StringKey; back?: string; backLabelKey?: StringKey }) {
  const t = useT();
  return (
    <Page width="focus">
      <PageHead back={back} backLabel={backLabelKey ? t(backLabelKey) : undefined} title={t(titleKey)} />
      <Card className="flex flex-col items-center px-6 py-9 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-orangetint text-orangedark">
          <Icon name="spark" size={26} />
        </span>
        <h2 className="mt-4 font-display text-[22px] text-ink">{t('aiLock.title')}</h2>
        <p className="mt-2 max-w-[440px] text-[14px] leading-[1.65] text-ink2 rtl:leading-[1.9]">{t('aiLock.body')}</p>
        <LinkBtn title={t('aiLock.cta')} href="/upgrade" variant="orange" icon="crown" className="mt-5" />
      </Card>
    </Page>
  );
}
