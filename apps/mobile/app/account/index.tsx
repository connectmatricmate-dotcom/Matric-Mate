import Constants from 'expo-constants';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Bar, Btn, Card, Header, IconButton, Item, Pill, Row, Screen, SectionTitle, Sheet, Small, Spacer } from '../../src/components/ui';
import { levelProgress, xpToNextLevel } from '@matricmate/core';
import { useT } from '../../src/i18n';
import { AVATARS, useApp } from '../../src/store/app';
import { useAuth } from '../../src/store/auth';
import { C, F, S } from '../../src/theme';

export default function Account() {
  const { state, derived } = useApp();
  const { signOut } = useAuth();
  const t = useT();
  const [confirmOut, setConfirmOut] = useState(false);
  const setup = state.onboarding;

  return (
    <>
      <Screen>
        <Header title={t('account.title')} back />

        <Card>
          <Row gap={S.md}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 18,
                backgroundColor: C.orangeTint,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 28 }}>{AVATARS[state.settings.avatar ?? 0] ?? AVATARS[0]}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontFamily: F.bodyBold, fontSize: 16, color: C.ink }}>{state.user?.name ?? 'Student'}</Text>
              <Small>
                {t('account.classLine', {
                  class: setup?.classLevel ?? 9,
                  board: setup?.board === 'punjab' ? 'Punjab Board' : 'FBISE',
                  medium: setup?.medium === 'ur' ? 'Urdu' : 'English',
                })}
              </Small>
              <Small numberOfLines={1}>{state.user?.contact}</Small>
            </View>
            <IconButton icon="edit" tone="card" onPress={() => router.push('/account/edit')} />
          </Row>
        </Card>

        <Spacer h={S.md} />
        <Card
          tint={state.premium.active ? C.orangeTint : undefined}
          border={state.premium.active ? C.orange : undefined}
          onPress={() => router.push('/account/subscription')}
        >
          <Row gap={S.md}>
            <Text style={{ fontSize: 24 }}>{state.premium.active ? '👑' : '🔓'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.bodyBold, fontSize: 14.5, color: C.ink }}>
                {state.premium.active ? t('account.premiumActive') : t('account.freeMode')}
              </Text>
              <Small>
                {state.premium.active && state.premium.validTill
                  ? t('account.premiumTill', {
                      date: new Date(state.premium.validTill).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
                    })
                  : t('account.freeModeSub')}
              </Small>
            </View>
            {/* No "Upgrade" call to action: Play treats that as steering to an
                out-of-Play purchase. The row still opens the read-only plan
                screen, which explains the position without selling anything. */}
            <Pill tone={state.premium.active ? 'green' : 'grey'}>
              {state.premium.active ? t('account.active') : t('billing.statusFree')}
            </Pill>
          </Row>
        </Card>

        <Spacer h={S.md} />
        <Card>
          <Row gap={S.md}>
            <Text style={{ fontSize: 22 }}>⚡</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.ink }}>
                {t('account.levelLine', { xp: state.xp, level: derived.level })}
              </Text>
              <View style={{ marginTop: 8 }}>
                <Bar pct={levelProgress(state.xp)} />
              </View>
            </View>
            <Small style={{ fontFamily: F.bodyBold }}>{t('account.toNextLevel', { n: xpToNextLevel(state.xp) })}</Small>
          </Row>
        </Card>

        <SectionTitle>{t('account.accountSection')}</SectionTitle>
        <Card flat style={{ paddingVertical: 0 }}>
          <Item title={t('account.paymentHistory')} icon="card" onPress={() => router.push('/account/payments')} />
          <Item
            title={t('account.downloads')}
            sub={t('account.downloadsSub', { n: state.downloads.length })}
            icon="download"
            onPress={() => router.push('/learn/downloads')}
          />
          <Item title={t('account.notifications')} icon="bell" onPress={() => router.push('/notifications')} />
          <Item title={t('account.settings')} icon="gear" onPress={() => router.push('/account/settings')} />
          <Item title={t('account.help')} icon="help" onPress={() => router.push('/account/help')} />
          <Item title={t('auth.logOut')} icon="logout" tone="red" last onPress={() => setConfirmOut(true)} right={<View />} />
        </Card>

        <Spacer h={S.lg} />
        <Small style={{ textAlign: 'center' }}>{t('account.version', { v: Constants.expoConfig?.version ?? '' })}</Small>
      </Screen>

      <Sheet visible={confirmOut} onClose={() => setConfirmOut(false)} title={t('auth.logOutConfirm')}>
        <Small>{t('auth.logOutBody')}</Small>
        <Spacer h={S.lg} />
        <Btn
          title={t('auth.logOut')}
          variant="danger"
          onPress={async () => {
            setConfirmOut(false);
            // Ends the Supabase session and clears the cached entitlement, so
            // the next person to open this phone starts from nothing.
            await signOut();
            router.replace('/welcome');
          }}
        />
        <Spacer h={S.sm} />
        <Btn title={t('auth.stayLoggedIn')} variant="ghost" onPress={() => setConfirmOut(false)} />
      </Sheet>
    </>
  );
}
