import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useApp } from '../store/app';
import { C, F, S } from '../theme';
import { H2, IconButton, Pill, Small, Tap } from './ui';

/** Tab-root header: avatar → profile, streak → progress, bell → notifications. */
export function AppHeader({
  eyebrow,
  title,
  showStreak = true,
}: {
  eyebrow?: string;
  title: string;
  showStreak?: boolean;
}) {
  const { state, derived } = useApp();
  const unread = state.notifications.some((n) => !n.read);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingTop: S.sm, paddingBottom: S.md }}>
      <Tap onPress={() => router.push('/account')}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 15,
            backgroundColor: C.orangeTint,
            borderWidth: 1,
            borderColor: C.line,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 21 }}>🧑🏽‍🎓</Text>
        </View>
      </Tap>

      <View style={{ flex: 1, minWidth: 0 }}>
        {eyebrow ? (
          <Small numberOfLines={1} style={{ fontFamily: F.bodyBold, fontSize: 12 }}>
            {eyebrow}
          </Small>
        ) : null}
        <H2 numberOfLines={1}>{title}</H2>
      </View>

      {showStreak && derived.streak > 0 ? (
        <Tap onPress={() => router.push('/(tabs)/progress')}>
          <Pill tone="orange" style={{ paddingVertical: 7, paddingHorizontal: 12 }}>
            <Text style={{ fontFamily: F.bodyBold, fontSize: 13, color: C.orangeDark }}>🔥 {derived.streak}</Text>
          </Pill>
        </Tap>
      ) : null}

      <IconButton icon="bell" tone="card" badge={unread} onPress={() => router.push('/notifications')} />
    </View>
  );
}
