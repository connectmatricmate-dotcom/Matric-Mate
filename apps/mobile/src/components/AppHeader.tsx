import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../store/app';
import { C, F, S } from '../theme';
import { Icon } from './Icon';
import { H2, Label, Pill, Tap } from './ui';

/** Tab-root header: avatar → profile, streak → progress, bell → notifications. */
export function AppHeader({ eyebrow, title, showStreak = true }: { eyebrow?: string; title: string; showStreak?: boolean }) {
  const { state, derived } = useApp();
  const unread = state.notifications.some((n) => !n.read);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingTop: S.sm, paddingBottom: S.sm }}>
      <Tap onPress={() => router.push('/account')}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            backgroundColor: C.orangeTint,
            borderWidth: 1,
            borderColor: C.line,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 20 }}>🧑🏽‍🎓</Text>
        </View>
      </Tap>
      <View style={{ flex: 1, minWidth: 0 }}>
        {eyebrow ? <Label>{eyebrow}</Label> : null}
        <H2 numberOfLines={1}>{title}</H2>
      </View>
      {showStreak && derived.streak > 0 ? (
        <Tap onPress={() => router.push('/(tabs)/progress')}>
          <Pill tone="orange" style={{ paddingVertical: 6 }}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: C.orangeDark }}>🔥 {derived.streak}</Text>
          </Pill>
        </Tap>
      ) : null}
      <Tap onPress={() => router.push('/notifications')}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            backgroundColor: C.card,
            borderWidth: 1,
            borderColor: C.line,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="bell" size={20} color={C.ink} />
          {unread ? (
            <View
              style={{
                position: 'absolute',
                top: 7,
                right: 7,
                width: 9,
                height: 9,
                borderRadius: 99,
                backgroundColor: C.orange,
                borderWidth: 2,
                borderColor: C.card,
              }}
            />
          ) : null}
        </View>
      </Tap>
    </View>
  );
}
