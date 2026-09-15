'use client';

import { useState } from 'react';
import { AI_QUOTA, subjectById, subjectName } from '@matricmate/core';
import { Page, Work } from '@/components/app/Page';
import { ItemButton } from '@/components/ui/controls';
import { Card, Icon } from '@/components/ui/primitives';
import { Confirm } from '@/components/ui/sheet';
import { useLang, useT } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';

/**
 * The free trial's one subject, picked, confirmed and started. The same
 * screen as the Android app's (apps/mobile/app/trial.tsx).
 *
 * There used to be a trial card on the plans page beside two plans to buy. A
 * new student now simply starts: three days, one subject, counted from the
 * confirm. Then the whole app opens on a fresh load, which reads the new plan
 * everywhere at once, and the dashboard greets them with what it opens.
 */
export function TrialStart({ offered }: { offered: { id: string; chapters: number }[] }) {
  const t = useT();
  const { lang } = useLang();
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = (id: string) => subjectName(subjectById(id), lang) || id;

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
    setPick(null);
    setBusy(false);
    if (/finish onboarding/.test(m)) {
      window.location.assign('/onboarding/class');
      return;
    }
    setError(
      /already used/.test(m)
        ? t('trial.errorUsed')
        : /already on a plan/.test(m)
          ? t('trial.errorPlan')
          : /had a plan|paid before/.test(m)
            ? t('trial.errorPaid')
            : /no chapters/.test(m)
              ? t('trialStart.errorNoChapters')
              : t('trial.errorGeneric'),
    );
  }

  return (
    <Page width="focus">
      <Work className="flex flex-col gap-4">
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-tealtint text-teal">
            <Icon name="party" size={26} />
          </span>
          <h1 className="mt-4 font-display text-[26px] text-ink">{t('trialStart.title')}</h1>
          <p className="mx-auto mt-2 max-w-[440px] text-[14.5px] leading-[1.65] text-ink2 rtl:leading-[1.9]">
            {t('trialStart.sub', { n: AI_QUOTA.trial })}
          </p>
        </div>

        <h2 className="mt-2 text-[14px] font-extrabold text-teal">{t('trialStart.pick')}</h2>
        {offered.length === 0 ? (
          <Card flat tint="bg-orangetint">
            <p className="text-[14px] text-ink2">{t('trialStart.none')}</p>
          </Card>
        ) : (
          <Card flat className="py-0">
            {offered.map((s, i) => (
              <ItemButton
                key={s.id}
                title={name(s.id)}
                sub={s.chapters ? t('study.chapterCount', { n: s.chapters }) : undefined}
                icon={subjectById(s.id)?.icon}
                right={<Icon name="chevron" size={18} className="text-ink3" />}
                last={i === offered.length - 1}
                onClick={() => setPick(s.id)}
              />
            ))}
          </Card>
        )}

        {error ? (
          <p role="alert" className="text-center text-[13px] font-extrabold text-red">
            {error}
          </p>
        ) : null}
      </Work>

      <Confirm
        open={!!pick}
        onClose={() => (busy ? undefined : setPick(null))}
        title={t('trialStart.confirmTitle', { subject: pick ? name(pick) : '' })}
        body={t('trialStart.confirmBody')}
        confirmLabel={t('trialStart.confirmCta', { subject: pick ? name(pick) : '' })}
        cancelLabel={t('common.cancel')}
        tone="primary"
        loading={busy}
        onConfirm={() => void start()}
      />
    </Page>
  );
}
