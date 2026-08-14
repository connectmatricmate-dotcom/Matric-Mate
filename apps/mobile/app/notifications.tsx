import { useEffect, useMemo } from 'react';
import { router } from 'expo-router';
import { Card, Empty, Header, Item, Screen, SectionTitle } from '../src/components/ui';
import { Notification, NotificationTarget } from '@matricmate/core';
import { useT } from '../src/i18n';
import { useApp } from '../src/store/app';

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

const ICON: Record<Notification['kind'], { emoji: string; tone: 'orange' | 'teal' | 'green' | 'grey' }> = {
  streak: { emoji: '🔥', tone: 'orange' },
  reminder: { emoji: '⏰', tone: 'teal' },
  report: { emoji: '📊', tone: 'green' },
  payment: { emoji: '🧾', tone: 'grey' },
};

export default function Notifications() {
  const { state, actions } = useApp();
  const t = useT();

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
        onPress={n.target ? () => router.push(ROUTE[n.target!] as never) : undefined}
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
