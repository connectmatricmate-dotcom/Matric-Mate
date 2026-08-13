/**
 * Web renderer for the shared avatar cast in @matricmate/core.
 *
 * The same shape data the Android app draws through react-native-svg,
 * rendered here as a plain inline <svg>, so a student's character looks
 * identical on their phone and on the website.
 */
import { AVATARS } from '@matricmate/core';

export function AvatarBadge({ index, size = 40 }: { index: number; size?: number }) {
  const avatar = AVATARS[index] ?? AVATARS[0];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={avatar.name}
      style={{ borderRadius: '50%', background: avatar.bg, flexShrink: 0 }}
    >
      {avatar.shapes.map((sh, i) => {
        switch (sh.k) {
          case 'c':
            return <circle key={i} cx={sh.cx} cy={sh.cy} r={sh.r} fill={sh.f} />;
          case 'e':
            return <ellipse key={i} cx={sh.cx} cy={sh.cy} rx={sh.rx} ry={sh.ry} fill={sh.f} />;
          case 'r':
            return <rect key={i} x={sh.x} y={sh.y} width={sh.w} height={sh.h} rx={sh.rx} fill={sh.f} />;
          case 'p':
            return (
              <path key={i} d={sh.d} fill={sh.f ?? 'none'} stroke={sh.s} strokeWidth={sh.sw} strokeLinecap="round" />
            );
        }
      })}
    </svg>
  );
}
