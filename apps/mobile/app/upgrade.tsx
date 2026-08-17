import { router } from 'expo-router';
import { View } from 'react-native';
import { AI_QUOTA } from '@matricmate/core';
import { Icon } from '../src/components/Icon';
import { LockedNotice } from '../src/components/LockedNotice';
import { Btn, Card, H2, Row, Screen, SectionTitle, Small, Spacer } from '../src/components/ui';
import { useT } from '../src/i18n';
import { useAuth } from '../src/store/auth';
import { useApp } from '../src/store/app';
import { C, S } from '../src/theme';

/**
 * Where a signed-in student without a plan lands, and the only screen they can
 * reach besides their own account.
 *
 * It cannot sell anything. What it can do is say plainly what a plan opens,
 * hand over a link to the website, and offer the one button that matters after
 * they have paid there: check again. That button is why students do not write
 * in. A payment made in a browser is invisible to this app until it re-reads
 * the server, and without something to press, the app looks broken to somebody
 * who has just paid.
 */
export default function Upgrade() {
  const t = useT();
  const { state } = useApp();
  const { refresh } = useAuth();

  const perks = ['billing.perk1', 'billing.perk2', 'billing.perk3', 'billing.perk4', 'billing.perk5'] as const;
  const expired = Boolean(state.premium.validTill);

  return (
    <Screen>
      <Spacer h={S.lg} />
      <Row gap={S.md}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 99,
            backgroundColor: C.orangeTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="crown" size={24} color={C.orangeDark} />
        </View>
        <View style={{ flex: 1 }}>
          <H2>{t('billing.statusFree')}</H2>
        </View>
      </Row>

      <Spacer h={S.md} />
      <LockedNotice variant={expired ? 'expired' : 'free'} />

      <SectionTitle>{t('billing.whatsIncluded')}</SectionTitle>
      <Card flat>
        {perks.map((key) => (
          <Row key={key} gap={S.sm} style={{ alignItems: 'flex-start', paddingVertical: 5 }}>
            <Icon name="check" size={17} color={C.green} strokeWidth={2.6} />
            <Small style={{ flex: 1, color: C.ink }}>{t(key, { n: AI_QUOTA.premium })}</Small>
          </Row>
        ))}
      </Card>

      <Spacer h={S.lg} />
      <Btn title={t('billing.checkAgain')} variant="line" icon="refresh" onPress={() => void refresh()} />
      <Spacer h={S.sm} />
      <Btn title={t('account.settingsTitle')} variant="ghost" onPress={() => router.push('/account')} />
      <Spacer h={S.lg} />
    </Screen>
  );
}
