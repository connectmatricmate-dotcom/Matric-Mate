import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Card, Empty, Header, Item, Screen, SectionTitle } from '../src/components/ui';
import { Notification, NotificationTarget } from '@matricmate/core';
import { useT } from '../src/i18n';
import { useApp } from '../src/store/app';
import { C } from '../src/theme';

/** Shared destinations, in this app's route names. See NotificationTarget. */
const ROUTE: Record<NotificationTarget, string> = {
  home: '/(tabs)',
  study: '/(tabs)/study',
  practice: '/(tabs)/practice',
  progress: '/(tabs)/progress',
  'session-setup': '/session/setup',
  report: '/insights/report',
  payments: '/account/payments',
  subscription: '/account/subscription',
};

/**
 * The targets that are tabs. Those are reached by going back down to the tabs
 * this inbox was opened from: pushed, they stacked a second set of tabs on top
 * of it, and back from that home screen came out on the inbox again.
 */
const TAB_TARGETS = new Set<NotificationTarget>(['home', 'study', 'practice', 'progress']);
const openTarget = (target: NotificationTarget) =>
  TAB_TARGETS.has(target) ? router.dismissTo(ROUTE[target] as never) : router.push(ROUTE[target] as never);

const ICON: Record<Notification['kind'], { emoji: string; tone: 'orange' | 'teal' | 'green' | 'grey' }> = {
  streak: { emoji: '🔥', tone: 'orange' },
  reminder: { emoji: '⏰', tone: 'teal' },
  report: { emoji: '📊', tone: 'green' },
  payment: { emoji: '🧾', tone: 'grey' },
};

export default function Notifications() {
  const { state, actions } = useApp();
  const t = useT();
  /**
   * What was unread when the inbox opened, kept for as long as it is open.
   * Everything is marked read a moment after opening, and with nothing
   * holding on to which ones were new, a new notice looked exactly like one
   * from last month.
   */
  const [fresh] = useState(() => new Set(state.notifications.filter((n) => !n.read).map((n) => n.id)));

  useEffect(() => {
    const timer = setTimeout(() => actions.readNotifications(), 400);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { today, earlier } = useMemo(() => {
    const start = new Date().setHours(0, 0, 0, 0);
    return {
      today: state.notifications.filter((n) => n.at >= start),
      // Capped: an inbox that scrolls forever stops being an inbox.
      earlier: state.notifications.filter((n) => n.at < start).slice(0, 30),
    };
  }, [state.notifications]);

  const row = (n: Notification, last: boolean) => {
    const meta = ICON[n.kind];
    return (
      <Item
        key={n.id}
        title={n.title}
        sub={n.body}
        emoji={meta.emoji}
        tone={meta.tone}
        last={last}
        // A read notice steps back a little; a new one keeps full strength
        // and a dot, so the two can be told apart.
        dim={!fresh.has(n.id)}
        onPress={n.target ? () => openTarget(n.target!) : undefined}
        right={
          fresh.has(n.id) ? (
            <View style={{ width: 9, height: 9, borderRadius: 99, backgroundColor: C.orange }} />
          ) : undefined
        }
      />
    );
  };

  return (
    <Screen>
      <Header title={t('notifications.title')} back />
      {state.notifications.length === 0 ? (
        <Empty emoji="🔔" title={t('notifications.emptyTitle')} sub={t('notifications.emptyBody')} />
      ) : (
        <>
          {today.length ? (
            <>
              <SectionTitle>{t('notifications.today')}</SectionTitle>
              <Card flat style={{ paddingVertical: 0 }}>
                {today.map((n, i) => row(n, i === today.length - 1))}
              </Card>
            </>
          ) : null}
          {earlier.length ? (
            <>
              <SectionTitle>{t('notifications.earlier')}</SectionTitle>
              <Card flat style={{ paddingVertical: 0 }}>
                {earlier.map((n, i) => row(n, i === earlier.length - 1))}
              </Card>
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}
