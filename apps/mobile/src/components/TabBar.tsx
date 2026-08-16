import { useEffect } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconName } from './Icon';
import { TabGlyph } from './TabGlyph';
import { Tap } from './ui';
import { C, F, R, isRTL, isWeb, rowDir } from '../theme';

/**
 * Only the parts of the navigator's tabBar props we actually use, typed here so
 * the component doesn't need a direct dependency on @react-navigation internals.
 */
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, { options: { title?: string; tabBarIconName?: IconName } }>;
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: never) => void;
  };
};

/**
 * One tab, one motion. The pill and its glyph land together with a single
 * spring when the tab becomes active; the press itself adds no ripple and no
 * flash, because two effects on one tap is exactly what read as cheap. The
 * cell stays a plain Pressable so the hit area is still the full column.
 */
function TabItem({
  focused,
  label,
  icon,
  onPress,
}: {
  focused: boolean;
  label: string;
  icon: IconName;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (focused && !reduced) {
      scale.value = withSequence(withSpring(1.14, { damping: 11, stiffness: 320 }), withSpring(1, { damping: 14 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, reduced]);

  const landing = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        minHeight: 48,
        borderRadius: R.md,
        ...(isWeb ? { cursor: 'pointer' as const } : null),
      }}
    >
      <Animated.View
        style={[
          {
            paddingHorizontal: 14,
            paddingVertical: 2,
            borderRadius: 99,
            backgroundColor: focused ? C.tealTint : 'transparent',
          },
          landing,
        ]}
      >
        <TabGlyph name={icon} focused={focused} />
      </Animated.View>
      <Text numberOfLines={1} style={{ fontFamily: F.bodyBold, fontSize: 10.5, color: focused ? C.teal : C.ink3 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Custom tab bar. Written by hand because the default one sizes itself
 * differently across platforms, here the height, the gesture-bar inset and the
 * label metrics are explicit, so a label can never end up under the system bar.
 * Wide web viewports get the same items as a left sidebar.
 */
export function TabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const sidebar = isWeb && width >= 900;

  const items = state.routes.map((route, index) => {
    const { options } = descriptors[route.key];
    const focused = state.index === index;
    const label = typeof options.title === 'string' ? options.title : route.name;
    const icon: IconName = options.tabBarIconName ?? 'home';

    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
    };

    return { key: route.key, focused, label, icon, onPress };
  });

  if (sidebar) {
    return (
      <View
        style={{
          width: 210,
          backgroundColor: C.card,
          // The divider is the edge facing the content, which swaps with the
          // sidebar itself once the app reads right to left.
          ...(isRTL()
            ? { borderLeftWidth: 1, borderLeftColor: C.line }
            : { borderRightWidth: 1, borderRightColor: C.line }),
          paddingTop: 20,
          paddingHorizontal: 10,
          gap: 4,
        }}
      >
        {items.map((it) => (
          <Tap key={it.key} onPress={it.onPress}>
            <View
              style={{
                flexDirection: rowDir(),
                alignItems: 'center',
                gap: 10,
                paddingVertical: 11,
                paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: it.focused ? C.tealTint : 'transparent',
              }}
            >
              <TabGlyph name={it.icon} focused={it.focused} />
              <Text style={{ fontFamily: F.bodyBold, fontSize: 13.5, color: it.focused ? C.teal : C.ink2 }}>
                {it.label}
              </Text>
            </View>
          </Tap>
        ))}
      </View>
    );
  }

  return (
    <View
      style={{
        // Home first means first in reading order, which is the right-hand end
        // of the bar in Urdu.
        flexDirection: rowDir(),
        backgroundColor: C.card,
        borderTopWidth: 1,
        borderTopColor: C.line,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 8),
      }}
    >
      {items.map((it) => (
        <TabItem key={it.key} focused={it.focused} label={it.label} icon={it.icon} onPress={it.onPress} />
      ))}
    </View>
  );
}
