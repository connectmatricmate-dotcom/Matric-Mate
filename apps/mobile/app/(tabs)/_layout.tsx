import { useWindowDimensions } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { Icon, IconName } from '../../src/components/Icon';
import { useApp } from '../../src/store/app';
import { C, F, isWeb } from '../../src/theme';

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home' },
  { name: 'study', title: 'Study', icon: 'book' },
  { name: 'practice', title: 'Practice', icon: 'target' },
  { name: 'tutor', title: 'AI Tutor', icon: 'spark' },
  { name: 'progress', title: 'Progress', icon: 'chart' },
];

/**
 * Five tabs; Profile lives in each screen's header avatar (see DESIGN-SPEC D1).
 * On a wide web viewport the bar moves to the left as a sidebar — same routes,
 * layout appropriate to the device.
 */
export default function TabLayout() {
  const { width } = useWindowDimensions();
  const { state, hydrated } = useApp();
  const sidebar = isWeb && width >= 900;

  // Deep-linking straight to a tab while signed out sends you to the welcome flow.
  if (hydrated && !state.user) return <Redirect href="/welcome" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: sidebar ? 'left' : 'bottom',
        tabBarActiveTintColor: C.teal,
        tabBarInactiveTintColor: C.ink3,
        tabBarActiveBackgroundColor: sidebar ? C.tealTint : 'transparent',
        tabBarInactiveBackgroundColor: 'transparent',
        tabBarLabelStyle: { fontFamily: F.bodyBold, fontSize: sidebar ? 13 : 10.5 },
        tabBarStyle: {
          backgroundColor: C.card,
          borderTopColor: C.line,
          borderRightColor: C.line,
          ...(sidebar ? { width: 208, paddingTop: 18 } : { height: 70, paddingTop: 8, paddingBottom: 12 }),
        },
        tabBarItemStyle: sidebar ? { borderRadius: 12, marginHorizontal: 10 } : undefined,
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color }) => <Icon name={t.icon} size={22} color={String(color)} />,
          }}
        />
      ))}
    </Tabs>
  );
}
