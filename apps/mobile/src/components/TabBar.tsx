import { Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconName } from './Icon';
import { Tap } from './ui';
import { C, F, R, isWeb } from '../theme';

/**
 * Only the parts of the navigator's tabBar props we actually use — typed here so
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
 * Custom tab bar. Written by hand because the default one sizes itself
 * differently across platforms — here the height, the gesture-bar inset and the
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
          borderRightWidth: 1,
          borderRightColor: C.line,
          paddingTop: 20,
          paddingHorizontal: 10,
          gap: 4,
        }}
      >
        {items.map((it) => (
          <Tap key={it.key} onPress={it.onPress}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 11,
                paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: it.focused ? C.tealTint : 'transparent',
              }}
            >
              <Icon name={it.icon} size={20} color={it.focused ? C.teal : C.ink3} />
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
        flexDirection: 'row',
        backgroundColor: C.card,
        borderTopWidth: 1,
        borderTopColor: C.line,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 8),
      }}
    >
      {items.map((it) => (
        <Tap key={it.key} onPress={it.onPress} style={{ flex: 1 }}>
          <View
            accessibilityRole="tab"
            accessibilityState={{ selected: it.focused }}
            accessibilityLabel={it.label}
            style={{ alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 46, borderRadius: R.md }}
          >
            <Icon name={it.icon} size={22} color={it.focused ? C.teal : C.ink3} />
            <Text
              numberOfLines={1}
              style={{ fontFamily: F.bodyBold, fontSize: 10.5, color: it.focused ? C.teal : C.ink3 }}
            >
              {it.label}
            </Text>
          </View>
        </Tap>
      ))}
    </View>
  );
}
