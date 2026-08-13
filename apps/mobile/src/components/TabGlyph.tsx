/**
 * The tab bar's chunky two-tone icons, drawn by hand as filled SVG.
 *
 * The client's words after the demo: the thin line icons read as boring, the
 * one filled orange flame was the only icon he liked. So navigation gets
 * solid, rounded, toy-like shapes: a teal body with an orange accent when
 * active, soft grey when not, and a little spring bounce on selection.
 *
 * Drawn here rather than pulled from an icon pack so the set is licensed by
 * nobody, styled by us, and weighs nothing.
 */
import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { C } from '../theme';
import type { IconName } from './Icon';

type Tone = { main: string; accent: string };

/** Each glyph paints with its two tones inside a 24x24 box. */
function Shape({ name, tone }: { name: string; tone: Tone }) {
  switch (name) {
    case 'home':
      return (
        <Svg width={26} height={26} viewBox="0 0 24 24">
          <Path d="M3.8 10.2 12 3.4l8.2 6.8c.5.4.8 1 .8 1.7v7.1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7.1c0-.7.3-1.3.8-1.7Z" fill={tone.main} />
          <Rect x={9.4} y={13.4} width={5.2} height={7.6} rx={1.6} fill={tone.accent} />
        </Svg>
      );
    case 'book':
      return (
        <Svg width={26} height={26} viewBox="0 0 24 24">
          <Path d="M12 5.6C10.2 4 7.4 3.4 4.6 3.7c-.9.1-1.6.9-1.6 1.8v11.6c0 1.1 1 1.9 2.1 1.8 2.4-.2 5 .3 6.9 1.9V5.6Z" fill={tone.main} />
          <Path d="M12 5.6c1.8-1.6 4.6-2.2 7.4-1.9.9.1 1.6.9 1.6 1.8v11.6c0 1.1-1 1.9-2.1 1.8-2.4-.2-5 .3-6.9 1.9V5.6Z" fill={tone.accent} />
        </Svg>
      );
    case 'target':
      return (
        <Svg width={26} height={26} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={9.4} fill={tone.main} />
          <Circle cx={12} cy={12} r={5.8} fill={C.card} />
          <Circle cx={12} cy={12} r={3.1} fill={tone.accent} />
        </Svg>
      );
    case 'spark':
      return (
        <Svg width={26} height={26} viewBox="0 0 24 24">
          <Path d="M12 2.6c.5 3.9 1.6 6.4 3.2 8 1.6 1.6 4.1 2.7 8 3.2v.4c-3.9.5-6.4 1.6-8 3.2-1.6 1.6-2.7 4.1-3.2 8h-.4c-.5-3.9-1.6-6.4-3.2-8-1.6-1.6-4.1-2.7-8-3.2v-.4c3.9-.5 6.4-1.6 8-3.2 1.6-1.6 2.7-4.1 3.2-8h.4Z" fill={tone.main} />
          <Circle cx={18.6} cy={5} r={2} fill={tone.accent} />
        </Svg>
      );
    case 'chart':
      return (
        <Svg width={26} height={26} viewBox="0 0 24 24">
          <Rect x={3.2} y={12.4} width={4.8} height={8.4} rx={1.8} fill={tone.main} />
          <Rect x={9.6} y={7.2} width={4.8} height={13.6} rx={1.8} fill={tone.accent} />
          <Rect x={16} y={3.2} width={4.8} height={17.6} rx={1.8} fill={tone.main} />
        </Svg>
      );
    default:
      return null;
  }
}

/** A tab icon that lands with a bounce when it becomes the active one. */
export function TabGlyph({ name, focused }: { name: IconName; focused: boolean }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (focused && !reduced) {
      scale.value = withSequence(withSpring(1.22, { damping: 9, stiffness: 300 }), withSpring(1, { damping: 12 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, reduced]);

  const a = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const tone: Tone = focused ? { main: C.teal, accent: C.orange } : { main: '#AEBEB6', accent: '#C6D2CB' };

  return (
    <Animated.View style={a}>
      <Shape name={name} tone={tone} />
    </Animated.View>
  );
}
