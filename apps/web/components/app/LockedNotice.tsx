'use client';

/**
 * Web counterpart of the Android app's LockedNotice.
 *
 * The Android build may only *describe* what's locked. Google Play forbids it
 * from linking anywhere near a checkout (packages/core/src/billing.ts). The web
 * app is where the subscription is actually sold, so here the same notice ends
 * in a real Upgrade button. Same copy keys, one extra affordance.
 *
 * On a free trial the lock means something else: the student has a plan of a
 * sort, and this subject is simply not the one it opens. So it says which
 * subject is, and sends them to both plans rather than straight to Premium.
 */
import { subjectById, subjectName } from '@matricmate/core';
import { UpgradeButton } from '@/components/commerce/UpgradeButton';
import { Card, Icon, LinkBtn } from '@/components/ui/primitives';
import { useApp, useLang, useT } from '@/lib/store';

export function LockedNotice({
  variant = 'locked',
  body,
  cta,
}: {
  variant?: 'locked' | 'expired' | 'free';
  body: string;
  cta: string;
}) {
  const { derived } = useApp();
  const t = useT();
  const { lang } = useLang();
  const trial = derived.access.tier === 'trial' && derived.access.trialSubject;

  if (trial) {
    const subject = subjectName(subjectById(derived.access.trialSubject ?? ''), lang) || derived.access.trialSubject || '';
    return (
      <Card flat tint="bg-orangetint" border="border-orangetint" className="flex items-start gap-3">
        <Icon name="lock" size={18} className="mt-0.5 shrink-0 text-orangedark" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-extrabold text-ink">{t('trial.lockedTitle')}</p>
          <p className="mt-0.5 text-[13.5px] leading-[1.6] text-ink rtl:leading-[1.9]">{t('trial.lockedBody', { subject })}</p>
          <LinkBtn title={t('trial.seePlans')} href="/upgrade" sm variant="orange" className="mt-3 w-full sm:w-auto" />
        </div>
      </Card>
    );
  }

  return (
    <Card flat tint="bg-tealtint" border="border-tealtint2" className="flex items-start gap-3">
      <Icon name="lock" size={18} className="mt-0.5 shrink-0 text-teal" />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] leading-[1.6] text-ink">{body}</p>
        {/* Straight to the plan. A student who has just hit a locked chapter
            has already decided; sending them to a pricing page to decide again
            is where they used to fall out. */}
        <UpgradeButton
          label={cta}
          sm
          variant={variant === 'expired' ? 'orange' : 'primary'}
          icon={null}
          className="mt-3"
          full
        />
      </div>
    </Card>
  );
}
