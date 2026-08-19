import { ActivityIndicator, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { IconName } from '../../src/components/Icon';
import { StaffAccount } from '../../src/components/StaffAccount';
import { TabBar } from '../../src/components/TabBar';
import { useT } from '../../src/i18n';
import type { StringKey } from '../../src/i18n';
import { useOnline } from '../../src/core/connectivity';
import { useApp } from '../../src/store/app';
import { useAuth } from '../../src/store/auth';
import { C } from '../../src/theme';

/**
 * The gap between "signed in" and "we know what they paid for".
 *
 * Deliberately plain: a second of the brand's own paper and a spinner, rather
 * than a skeleton of a dashboard we may be about to redirect away from.
 */
function Waiting() {
  return (
    <View style={{ flex: 1, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={C.teal} />
    </View>
  );
}

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
  const { entitlementReady, role } = useAuth();
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

  /*
   * Staff are not students.
   *
   * A teacher on the referral programme and an administrator both live in the
   * same auth system and neither has a subscription, so without this they fell
   * through to the paywall and were asked to buy the product they help run.
   * Before the plan check for exactly that reason, and after entitlementReady
   * so the role has been read.
   */
  if (hydrated && state.user && entitlementReady && role !== 'student') return <StaffAccount />;

  /**
   * No plan, no tabs.
   *
   * There is no free tier any more, so a signed-in student without a plan has
   * nothing to do on any of these five screens: every chapter, question and
   * the tutor need one. Sending them to the paywall is honest about that,
   * rather than showing five screens of locks.
   *
   * Checked after the offline redirect on purpose: somebody who has already
   * paid and downloaded chapters can still read them on a plane, and bouncing
   * them to a paywall they cannot reach the server to satisfy would take away
   * something they bought.
   *
   * And it waits for entitlementReady. Entitlement starts as "none" and is
   * fetched without blocking sign-in, so without that wait a paying student
   * on a slow connection gets thrown at the paywall for the second or two
   * before their plan loads, and nothing on the paywall sends them back.
   */
  /*
   * And until it IS ready, hold rather than render.
   *
   * Waiting to redirect was only half of it. The tabs still painted in the
   * meantime, with entitlement at its "none" default, so a student who had
   * just signed up watched a dashboard full of locks and a "free plan" badge
   * and then got thrown at the paywall a moment later. Neither screen was a
   * lie on its own; the sequence was. A brief hold is honest: we do not yet
   * know what they have.
   */
  if (hydrated && state.user && !entitlementReady) return <Waiting />;

  if (hydrated && state.user && !state.premium.active) return <Redirect href="/upgrade" />;

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
