import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { AvatarBadge } from './AvatarBadge';
import { useApp } from '../store/app';
import { C, F, S } from '../theme';
import { H2, IconButton, Pill, Small, Tap } from './ui';

/** Tab-root header: streak → progress, gear → settings, bell → notifications.
 *  The avatar is identity, not a control: settings are behind the gear only. */
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
      {/* The avatar disc carries its own tint; a second box behind it read
          as a mistake (the client's words: double background). */}
      <AvatarBadge index={state.settings.avatar ?? 0} size={42} />

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

      {/* Settings used to live only behind the avatar, which nothing marks as
          tappable. A gear is the one icon every student already knows. */}
      <IconButton icon="gear" tone="card" onPress={() => router.push('/account')} />
      <IconButton icon="bell" tone="card" badge={unread} onPress={() => router.push('/notifications')} />
    </View>
  );
}
