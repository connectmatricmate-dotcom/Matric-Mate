/**
 * Android renderer for the shared avatar cast in @matricmate/core.
 *
 * An emoji on its own tint disc, with a hairline ring so the disc keeps its
 * edge on white cards. The characters live in core as data, so the web app
 * draws the same one from the same file.
 */
import { Text, View } from 'react-native';
import { AVATARS } from '@matricmate/core';

export function AvatarBadge({ index, size = 40 }: { index: number; size?: number }) {
  const avatar = AVATARS[index] ?? AVATARS[0];
  return (
    <View
      accessibilityLabel={avatar.name}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: avatar.bg,
        borderWidth: 1,
        borderColor: 'rgba(15,61,76,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        allowFontScaling={false}
        style={{ fontSize: size * 0.5, lineHeight: size * 0.66, includeFontPadding: false }}
      >
        {avatar.emoji}
      </Text>
    </View>
  );
}
