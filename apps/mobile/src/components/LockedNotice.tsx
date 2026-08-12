import { View } from 'react-native';
import { BILLING_SITE } from '@matricmate/core';
import { useT } from '../i18n';
import { C, S } from '../theme';
import { Card, Row, Small } from './ui';
import { Icon } from './Icon';

/**
 * Everything this app is allowed to say about paying.
 *
 * Google Play forbids a Play-distributed app from selling digital content
 * outside Play Billing, and equally forbids steering towards it: no price, no
 * plan picker, no "Upgrade" button, no tappable link to a checkout. See
 * core/billing.ts.
 *
 * What is allowed is naming, as plain text, where the account is managed, and
 * contacting the student outside the app.
 *
 * There used to be an "Email me the link" button here that only flipped its
 * own label to "Saved": no server call existed, so it told a student their
 * email was on the way and sent nothing. A control that lies is worse than no
 * control. It comes back when the server can actually send that mail, see
 * docs/CLIENT-ACTIONS.md.
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
          <Small style={{ marginTop: 4 }}>{t('billing.howToUpgrade')}</Small>
        </View>
      </Row>
    </Card>
  );
}
