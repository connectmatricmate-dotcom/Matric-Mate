import { View } from 'react-native';
import { BILLING_SITE } from '@matricmate/core';
import { useT } from '../i18n';
import { C, S } from '../theme';
import { Card, Row, Small } from './ui';
import { Icon } from './Icon';

/**
 * The only thing the app may say about paying: what's locked, and, as plain,
 * non-tappable text, where subscriptions are managed. No price, no button, no
 * link. See core/billing.ts.
 */
export function LockedNotice({ variant = 'locked' }: { variant?: 'locked' | 'expired' | 'free' }) {
  const t = useT();
  const body =
    variant === 'expired' ? t('billing.expiredBody') : variant === 'free' ? t('billing.freeBody') : t('billing.lockedBody');

  return (
    <Card flat tint={C.tealTint}>
      <Row gap={S.sm} style={{ alignItems: 'flex-start' }}>
        <Icon name="lock" size={18} color={C.teal} />
        <View style={{ flex: 1 }}>
          <Small style={{ color: C.ink }}>{body}</Small>
          {/* Plain text on purpose, must never be tappable. */}
          <Small style={{ marginTop: 4 }}>{t('billing.manageNote', { site: BILLING_SITE })}</Small>
        </View>
      </Row>
    </Card>
  );
}
