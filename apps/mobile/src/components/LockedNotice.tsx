import { View } from 'react-native';
import { subjectById, subjectName } from '@matricmate/core';
import { useLang, useT } from '../i18n';
import { useApp } from '../store/app';
import { C, F, S } from '../theme';
import { Card, Row, Small } from './ui';
import { Icon } from './Icon';

/**
 * What a locked chapter or subject says in the Android app: that it is
 * locked, and nothing about buying.
 *
 * It used to name the plans, offer "See the plans" and copy a sign-in link to
 * the website's plans page. Google Play forbids leading anyone to pay outside
 * Play, by link, button or instruction, and Pakistan is in no programme that
 * allows it (core/billing.ts), so none of that is here. How to continue
 * reaches the student outside the app: the reminder emails, the website,
 * their teacher.
 */
export function LockedNotice() {
  const t = useT();
  const { lang } = useLang();
  const { derived } = useApp();

  // On a free trial the lock means this subject is not the one it opens.
  if (derived.access.tier === 'trial' && derived.access.trialSubject) {
    const subject = subjectName(subjectById(derived.access.trialSubject), lang) || derived.access.trialSubject;
    return (
      <Card flat tint={C.orangeTint}>
        <Row gap={S.sm} style={{ alignItems: 'flex-start' }}>
          <Icon name="lock" size={18} color={C.orangeDark} />
          <View style={{ flex: 1 }}>
            <Small style={{ color: C.ink, fontFamily: F.bodyBold }}>{t('trial.lockedTitle')}</Small>
            <Small style={{ marginTop: 4, color: C.ink }}>{t('access.lockedTrialBody', { subject })}</Small>
          </View>
        </Row>
      </Card>
    );
  }

  return (
    <Card flat tint={C.tealTint}>
      <Row gap={S.sm} style={{ alignItems: 'flex-start' }}>
        <Icon name="lock" size={18} color={C.teal} />
        <View style={{ flex: 1 }}>
          <Small style={{ color: C.ink }}>{t('access.lockedNoPlan')}</Small>
        </View>
      </Row>
    </Card>
  );
}
