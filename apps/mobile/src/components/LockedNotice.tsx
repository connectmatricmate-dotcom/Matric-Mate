import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { BILLING_SITE, fetchUpgradeLink, subjectById, subjectName } from '@matricmate/core';
import { useLang, useT } from '../i18n';
import { useApp } from '../store/app';
import { C, F, S } from '../theme';
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
  const { lang } = useLang();
  const { derived } = useApp();

  /*
   * On a free trial the lock means something else: the student has a plan of
   * a sort, and this subject is not the one it opens. So it says which one is,
   * and goes to the plans screen, which describes both plans (with no prices:
   * see core/billing.ts). The same notice as the website's.
   */
  if (derived.access.tier === 'trial' && derived.access.trialSubject) {
    const subject = subjectName(subjectById(derived.access.trialSubject), lang) || derived.access.trialSubject;
    return (
      <Card flat tint={C.orangeTint}>
        <Row gap={S.sm} style={{ alignItems: 'flex-start' }}>
          <Icon name="lock" size={18} color={C.orangeDark} />
          <View style={{ flex: 1 }}>
            <Small style={{ color: C.ink, fontFamily: F.bodyBold }}>{t('trial.lockedTitle')}</Small>
            <Small style={{ marginTop: 4, color: C.ink }}>{t('trial.lockedBody', { subject })}</Small>
            <Spacer h={S.sm} />
            <Btn title={t('trial.seePlans')} variant="orange" sm onPress={() => router.push('/upgrade')} />
          </View>
        </Row>
      </Card>
    );
  }

  const body =
    variant === 'expired' ? t('billing.expiredBody') : variant === 'free' ? t('billing.freeBody') : t('billing.lockedBody');

  return (
    <Card flat tint={C.tealTint}>
      <Row gap={S.sm} style={{ alignItems: 'flex-start' }}>
        <Icon name="lock" size={18} color={C.teal} />
        <View style={{ flex: 1 }}>
          <Small style={{ color: C.ink }}>{body}</Small>
          <PlanLink />
        </View>
      </Row>
    </Card>
  );
}

/**
 * Where plans are managed, and the copied sign-in link to it: the part of the
 * notice the plans screen needs on its own, for a student on Basic or a trial
 * whom "no plan yet" would describe wrongly.
 */
export function PlanLink({ bare }: { bare?: boolean }) {
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

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
    <>
      {/* Plain text, never tappable: the address itself is information, an
          opening link would be a redirect. `bare` where the screen has
          already said where plans live. */}
      {bare ? null : <Small style={{ marginTop: 4 }}>{t('billing.manageNote', { site: BILLING_SITE })}</Small>}
      <Small style={{ marginTop: 4 }}>{t('billing.copyLinkNote')}</Small>

      <Spacer h={S.sm} />
      <Btn title={t('billing.copyLink')} variant="line" sm icon="doc" loading={busy} onPress={copyLink} />
    </>
  );
}
