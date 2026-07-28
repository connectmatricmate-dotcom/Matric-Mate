/**
 * Web counterpart of the Android app's LockedNotice.
 *
 * The Android build may only *describe* what's locked. Google Play forbids it
 * from linking anywhere near a checkout (packages/core/src/billing.ts). The web
 * app is where the subscription is actually sold, so here the same notice ends
 * in a real Upgrade button. Same copy keys, one extra affordance.
 */
import { Card, Icon, LinkBtn } from '@/components/ui/primitives';

export function LockedNotice({
  variant = 'locked',
  body,
  cta,
}: {
  variant?: 'locked' | 'expired' | 'free';
  body: string;
  cta: string;
}) {
  return (
    <Card flat tint="bg-tealtint" border="border-tealtint2" className="flex items-start gap-3">
      <Icon name="lock" size={18} className="mt-0.5 shrink-0 text-teal" />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] leading-[1.6] text-ink">{body}</p>
        <LinkBtn
          title={cta}
          href="/pricing"
          sm
          variant={variant === 'expired' ? 'orange' : 'primary'}
          className="mt-3"
        />
      </div>
    </Card>
  );
}
