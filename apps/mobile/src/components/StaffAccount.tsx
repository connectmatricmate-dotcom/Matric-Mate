import { View } from 'react-native';
import { BILLING_SITE } from '@matricmate/core';
import { useAuth } from '../store/auth';
import { useT } from '../i18n';
import { C, F, S } from '../theme';
import { Body, Btn, Card, H2, Screen, Small, Spacer, Text } from './ui';
import { Icon } from './Icon';

/**
 * What a teacher or an administrator sees if they sign in to the app.
 *
 * They exist in the same auth system as the students and have no subscription,
 * so without this they fell straight through to the paywall and were asked to
 * buy the product they help run. Their screens are on the website; here they
 * only need telling, and a way out.
 *
 * Deliberately not an admin panel. Managing teachers and recording payouts on
 * a phone is not a thing anybody asked for, and a half version of it would be
 * worse than a clear signpost.
 */
export function StaffAccount() {
  const { role, signOut } = useAuth();
  const t = useT();

  return (
    <Screen>
      <Spacer h={S.xl} />
      <View style={{ alignItems: 'center', gap: S.md }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 22,
            backgroundColor: C.tealTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="user" size={30} color={C.teal} />
        </View>
        <H2 style={{ textAlign: 'center' }}>{t('auth.staffTitle')}</H2>
        <Body style={{ textAlign: 'center', color: C.ink2 }}>{t('auth.staffBody', { site: BILLING_SITE })}</Body>
      </View>

      <Spacer h={S.lg} />
      <Card flat tint={C.tealTint}>
        <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: C.teal }}>
          {t(role === 'admin' ? 'auth.roleAdmin' : 'auth.rolePartner')}
        </Text>
        <Small style={{ marginTop: 2 }}>{t('auth.staffStudentNote')}</Small>
      </Card>

      <Spacer h={S.lg} />
      <Btn title={t('auth.logOut')} variant="line" onPress={() => void signOut()} />
    </Screen>
  );
}
