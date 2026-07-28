import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { Bar, Btn, Card, Header, Item, Pill, Row, Screen, SectionTitle, Sheet, Small, Spacer, Tap } from '../../src/components/ui';
import { levelProgress, xpToNextLevel } from '../../src/core/domain';
import { useApp } from '../../src/store/app';
import { C, F, S } from '../../src/theme';
import { useState } from 'react';

export default function Account() {
  const { state, actions, derived } = useApp();
  const [confirmOut, setConfirmOut] = useState(false);
  const setup = state.onboarding;

  return (
    <>
      <Screen>
        <Header title="Profile" back />

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
              <Text style={{ fontSize: 28 }}>🧑🏽‍🎓</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontFamily: F.bodyBold, fontSize: 16, color: C.ink }}>{state.user?.name ?? 'Student'}</Text>
              <Small>
                Class {setup?.classLevel ?? 9} · {setup?.board === 'punjab' ? 'Punjab Board' : 'FBISE'} ·{' '}
                {setup?.medium === 'ur' ? 'Urdu' : 'English'} medium
              </Small>
              <Small>{state.user?.contact}</Small>
            </View>
            <Tap onPress={() => router.push('/account/edit')}>
              <View style={{ width: 40, height: 40, borderRadius: 14, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="edit" size={18} color={C.ink} />
              </View>
            </Tap>
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
                {state.premium.active ? 'Premium active' : 'Free mode'}
              </Text>
              <Small>
                {state.premium.active && state.premium.validTill
                  ? `Till ${new Date(state.premium.validTill).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · renews manually`
                  : '5 MCQs and 5 AI questions a day'}
              </Small>
            </View>
            {state.premium.active ? <Icon name="chevron" size={18} color={C.ink3} /> : <Pill tone="orange">Upgrade</Pill>}
          </Row>
        </Card>

        <Spacer h={S.md} />
        <Card>
          <Row gap={S.md}>
            <Text style={{ fontSize: 22 }}>⚡</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.bodyBold, fontSize: 14, color: C.ink }}>
                {state.xp} XP · Level {derived.level}
              </Text>
              <View style={{ marginTop: 7 }}>
                <Bar pct={levelProgress(state.xp)} />
              </View>
            </View>
            <Small style={{ fontFamily: F.bodyBold }}>{xpToNextLevel(state.xp)} to go</Small>
          </Row>
        </Card>

        <SectionTitle>Account</SectionTitle>
        <Card flat style={{ paddingVertical: 2 }}>
          <Item title="Payment history" icon="card" onPress={() => router.push('/account/payments')} />
          <Item title="Downloads" sub={`${state.downloads.length} chapters offline`} icon="download" onPress={() => router.push('/learn/downloads')} />
          <Item title="Notifications" icon="bell" onPress={() => router.push('/notifications')} />
          <Item title="Settings" icon="gear" onPress={() => router.push('/account/settings')} />
          <Item title="Help & support" icon="help" onPress={() => router.push('/account/help')} />
          <Item
            title="Log out"
            icon="logout"
            tone="red"
            last
            onPress={() => setConfirmOut(true)}
            right={<View />}
          />
        </Card>
        <Spacer h={S.lg} />
        <Small style={{ textAlign: 'center' }}>MatricMate demo build · v0.1.0</Small>
      </Screen>

      <Sheet visible={confirmOut} onClose={() => setConfirmOut(false)} title="Log out?">
        <Small>Your progress stays saved on this device.</Small>
        <Spacer h={S.lg} />
        <Btn
          title="Log out"
          variant="danger"
          onPress={() => {
            setConfirmOut(false);
            actions.signOut();
            router.replace('/welcome');
          }}
        />
        <Spacer h={S.sm} />
        <Btn title="Stay logged in" variant="ghost" onPress={() => setConfirmOut(false)} />
      </Sheet>
    </>
  );
}
