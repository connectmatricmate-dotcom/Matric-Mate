import Svg, { Path } from 'react-native-svg';
import { ICON_PATHS, IconName } from '@matricmate/core';
import { C } from '../theme';

export type { IconName };
export { SUBJECT_ICON } from '@matricmate/core';

export function Icon({
  name,
  size = 20,
  color = C.ink,
  strokeWidth = 1.9,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={ICON_PATHS[name]}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
