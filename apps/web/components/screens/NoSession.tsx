'use client';

/**
 * A session lives in memory, so a refresh or a shared link lands here. Better a
 * signposted way back than an empty screen or a crash.
 */
import { Card, LinkBtn } from '@/components/ui/primitives';
import { useT } from '@/lib/store';

export function NoSession() {
  const t = useT();
  return (
    <Card flat className="mx-auto mt-8 flex max-w-[440px] flex-col items-center gap-3 py-8 text-center">
      <h1 className="font-display text-[19px] text-ink">{t('session.noSession')}</h1>
      <p className="text-[13.5px] text-ink2">{t('session.noSessionBody')}</p>
      <LinkBtn title={t('session.setUpSession')} href="/session/setup" sm />
    </Card>
  );
}
