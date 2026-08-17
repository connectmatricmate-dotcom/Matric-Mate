/**
 * Web renderer for the shared avatar cast in @matricmate/core.
 *
 * The same emoji-on-tint-disc the Android app draws, so a student's
 * character looks identical on their phone and on the website.
 */
import { AVATARS } from '@matricmate/core';

export function AvatarBadge({ index, size = 40 }: { index: number; size?: number }) {
  const avatar = AVATARS[index] ?? AVATARS[0];
  return (
    <span
      role="img"
      aria-label={avatar.name}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: avatar.bg,
        boxShadow: 'inset 0 0 0 1px var(--shadow-ring)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.5,
        lineHeight: 1,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {avatar.emoji}
    </span>
  );
}
