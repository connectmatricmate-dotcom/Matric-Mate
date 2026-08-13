/**
 * Android renderer for the shared avatar cast in @matricmate/core.
 *
 * One switch over four primitive kinds; the characters themselves live in
 * core as data so the web app draws pixel-identical ones from the same file.
 */
import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { AVATARS } from '@matricmate/core';

export function AvatarBadge({ index, size = 40 }: { index: number; size?: number }) {
  const avatar = AVATARS[index] ?? AVATARS[0];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: avatar.bg,
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 48 48">
        {avatar.shapes.map((sh, i) => {
          switch (sh.k) {
            case 'c':
              return <Circle key={i} cx={sh.cx} cy={sh.cy} r={sh.r} fill={sh.f} />;
            case 'e':
              return <Ellipse key={i} cx={sh.cx} cy={sh.cy} rx={sh.rx} ry={sh.ry} fill={sh.f} />;
            case 'r':
              return <Rect key={i} x={sh.x} y={sh.y} width={sh.w} height={sh.h} rx={sh.rx} fill={sh.f} />;
            case 'p':
              return (
                <Path
                  key={i}
                  d={sh.d}
                  fill={sh.f ?? 'none'}
                  stroke={sh.s}
                  strokeWidth={sh.sw}
                  strokeLinecap="round"
                />
              );
          }
        })}
      </Svg>
    </View>
  );
}
