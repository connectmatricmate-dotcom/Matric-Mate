import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { URDU_LINE_HEIGHT, fontSize, isUrduScript } from '@matricmate/core';
import { AvatarBadge } from './AvatarBadge';
import { useApp } from '../store/app';
import { useT } from '../i18n';
import { C, F, S, rowDir } from '../theme';
import { H2, IconButton, Pill, Small, Tap, Text } from './ui';
import { TrialBanner } from './TrialBanner';

/** Tab-root header: streak → progress, gear → settings, bell → notifications.
 *  The avatar is identity, not a control: settings are behind the gear only. */
export function AppHeader({
  eyebrow,
  title,
  showStreak = true,
  right,
}: {
  eyebrow?: string;
  title: string;
  showStreak?: boolean;
  /**
   * One thing that belongs to this tab, sitting before the shared controls.
   * The tutor tab has the quota ring, which is why it used to draw a header of
   * its own and lose the gear and the bell with it.
   */
  right?: React.ReactNode;
}) {
  const { state, derived } = useApp();
  const t = useT();
  const unread = state.notifications.some((n) => !n.read);

  return (
    <>
    <View style={{ flexDirection: rowDir(), alignItems: 'center', gap: S.sm, paddingTop: S.sm, paddingBottom: S.md }}>
      {/* The avatar disc carries its own tint; a second box behind it read
          as a mistake (the client's words: double background). */}
      <AvatarBadge index={state.settings.avatar ?? 0} size={42} />

      <View style={{ flex: 1, minWidth: 0 }}>
        {/* Up to two lines: the study tab's is the whole setup, and "Class 9
            · Punjab Board · English medium" lost its medium to an ellipsis on
            a 390dp phone. */}
        {eyebrow ? (
          <Small numberOfLines={2} style={{ fontFamily: F.bodyBold, fontSize: 12 }}>
            {eyebrow}
          </Small>
        ) : null}
        {/* A title with Urdu in it gets the Nastaliq face and its leading even
            in the English interface: the greeting carries the student's own
            name, and one written in Urdu lost its descenders to the Latin
            line height. */}
        <H2
          numberOfLines={1}
          style={
            isUrduScript(title)
              ? { fontFamily: F.urduBold, lineHeight: Math.round(fontSize.h2 * URDU_LINE_HEIGHT) }
              : undefined
          }
        >
          {title}
        </H2>
      </View>

      {right}

      {showStreak && derived.streak > 0 ? (
        <Tap onPress={() => router.push('/(tabs)/progress')} hit label={t('dash.streakChip', { n: derived.streak })}>
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
    {/* A running free trial, on every tab root, as on every page of the website. */}
    <TrialBanner />
    </>
  );
}
