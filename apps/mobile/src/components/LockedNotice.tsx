import { useState } from 'react';
import { View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { BILLING_SITE, fetchUpgradeLink } from '@matricmate/core';
import { useT } from '../i18n';
import { C, S } from '../theme';
import { Btn, Card, Row, Small, Spacer, useToast } from './ui';
import { Icon } from './Icon';

/**
 * Everything this app says about paying.
 *
 * The app cannot take a payment: Google Play requires Play Billing for digital
 * content sold in the app, and this subscription is sold on the website. So
 * the most this can do is hand the student the address.
 *
 * It hands it over as a copied link rather than opening the browser, which is
 * a deliberate call the client made with the trade-off on the table. Play's
 * payments policy treats links, buttons and instructions that point at an
 * outside checkout as steering, and a copy button is the same category as a
 * redirect, not a lighter one. It is here because it is what the client asked
 * for, knowing that. If the listing is ever challenged, this component and
 * `billing.copyLinkNote` are the whole surface to remove.
 *
 * The link signs the student in on the other side, so they do not type a
 * password twice. See apps/web/app/api/upgrade-link/route.ts: it is single
 * use, short lived, and can only ever be minted for the account that asked.
 */
export function LockedNotice({ variant = 'locked' }: { variant?: 'locked' | 'expired' | 'free' }) {
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const body =
    variant === 'expired' ? t('billing.expiredBody') : variant === 'free' ? t('billing.freeBody') : t('billing.lockedBody');

  async function copyLink() {
    if (busy) return;
    setBusy(true);
    const url = await fetchUpgradeLink();
    setBusy(false);
    if (!url) {
      toast(t('billing.linkFailed'));
      return;
    }
    await Clipboard.setStringAsync(url);
    toast(t('billing.linkCopied'));
  }

  return (
    <Card flat tint={C.tealTint}>
      <Row gap={S.sm} style={{ alignItems: 'flex-start' }}>
        <Icon name="lock" size={18} color={C.teal} />
        <View style={{ flex: 1 }}>
          <Small style={{ color: C.ink }}>{body}</Small>
          {/* Plain text, never tappable: the address itself is information, an
              opening link would be a redirect. */}
          <Small style={{ marginTop: 4 }}>{t('billing.manageNote', { site: BILLING_SITE })}</Small>
          <Small style={{ marginTop: 4 }}>{t('billing.copyLinkNote')}</Small>

          <Spacer h={S.sm} />
          <Btn title={t('billing.copyLink')} variant="line" sm icon="doc" loading={busy} onPress={copyLink} />
        </View>
      </Row>
    </Card>
  );
}
