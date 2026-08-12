import { Redirect, Tabs } from 'expo-router';
import { IconName } from '../../src/components/Icon';
import { TabBar } from '../../src/components/TabBar';
import { useT } from '../../src/i18n';
import type { StringKey } from '../../src/i18n';
import { useOnline } from '../../src/core/connectivity';
import { useApp } from '../../src/store/app';
import { C } from '../../src/theme';

const TABS: { name: string; label: StringKey; icon: IconName }[] = [
  { name: 'index', label: 'tabs.home', icon: 'home' },
  { name: 'study', label: 'tabs.study', icon: 'book' },
  { name: 'practice', label: 'tabs.practice', icon: 'target' },
  { name: 'tutor', label: 'tabs.tutor', icon: 'spark' },
  { name: 'progress', label: 'tabs.progress', icon: 'chart' },
];

/**
 * Five tabs; Profile lives in each screen's header avatar (DESIGN-SPEC D1).
 * The bar itself is ours, see components/TabBar.
 */
export default function TabLayout() {
  const { state, hydrated } = useApp();
  const online = useOnline();
  const t = useT();

  // Deep-linking to a tab while signed out sends you to the welcome flow.
  if (hydrated && !state.user) return <Redirect href="/welcome" />;

  /**
   * No signal: swap the five tabs for the downloaded library.
   *
   * Four of the five need a server to say anything true, so leaving them up
   * would be five screens of failed requests. Only the tabs redirect, which
   * means a student who loses signal mid-chapter stays in the reader and keeps
   * working; they meet this the next time they come back to a tab.
   */
  if (hydrated && state.user && !online) return <Redirect href="/offline" />;

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.paper } }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{ title: t(tab.label), tabBarIconName: tab.icon } as never}
        />
      ))}
    </Tabs>
  );
}
