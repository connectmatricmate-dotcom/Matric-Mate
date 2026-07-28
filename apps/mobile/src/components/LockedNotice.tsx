import { useState } from 'react';
import { View } from 'react-native';
import { BILLING_SITE } from '@matricmate/core';
import { useT } from '../i18n';
import { C, S } from '../theme';
import { Btn, Card, Row, Small, useToast } from './ui';
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
 * contacting the student outside the app. So the one action here opens nothing:
 * it asks the server to email them the link. The message leaves Play's surface
 * entirely, which is the same route Netflix and Spotify take. The difference is
 * that we do the typing for them instead of leaving them at a dead end.
 */
export function LockedNotice({ variant = 'locked' }: { variant?: 'locked' | 'expired' | 'free' }) {
  const t = useT();
  const toast = useToast();
  const [sent, setSent] = useState(false);

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

          <View style={{ marginTop: S.md, alignSelf: 'flex-start' }}>
            <Btn
              title={sent ? t('common.saved') : t('billing.emailLink')}
              variant="line"
              sm
              icon="mail"
              disabled={sent}
              onPress={() => {
                // Deliberately no navigation and no Linking.openURL: the server
                // sends the mail, so nothing in the app points at a checkout.
                setSent(true);
                toast(t('billing.emailLinkSent'));
              }}
            />
          </View>
        </View>
      </Row>
    </Card>
  );
}
