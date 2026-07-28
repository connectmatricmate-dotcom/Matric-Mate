import { useEffect, useMemo } from 'react';
import { router } from 'expo-router';
import { Card, Empty, Header, Item, Screen, SectionTitle } from '../src/components/ui';
import { Notification } from '../src/core/types';
import { useApp } from '../src/store/app';

const ICON: Record<Notification['kind'], { emoji: string; tone: 'orange' | 'teal' | 'green' | 'grey' }> = {
  streak: { emoji: '🔥', tone: 'orange' },
  reminder: { emoji: '⏰', tone: 'teal' },
  report: { emoji: '📊', tone: 'green' },
  payment: { emoji: '🧾', tone: 'grey' },
};

export default function Notifications() {
  const { state, actions } = useApp();

  // Opening the screen marks everything read — the dot on the bell clears.
  useEffect(() => {
    const t = setTimeout(() => actions.readNotifications(), 400);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { today, earlier } = useMemo(() => {
    const start = new Date().setHours(0, 0, 0, 0);
    return {
      today: state.notifications.filter((n) => n.at >= start),
      earlier: state.notifications.filter((n) => n.at < start),
    };
  }, [state.notifications]);

  function row(n: Notification, last: boolean) {
    const meta = ICON[n.kind];
    return (
      <Item
        key={n.id}
        title={n.title}
        sub={n.body}
        emoji={meta.emoji}
        tone={meta.tone}
        last={last}
        onPress={n.href ? () => router.push(n.href as never) : undefined}
      />
    );
  }

  return (
    <Screen>
      <Header title="Notifications" back />
      {state.notifications.length === 0 ? (
        <Empty emoji="🔔" title="No notifications yet" sub="We’ll nudge you when it matters — reminders, streaks and your report card." />
      ) : (
        <>
          {today.length ? (
            <>
              <SectionTitle>Today</SectionTitle>
              <Card flat style={{ paddingVertical: 2 }}>{today.map((n, i) => row(n, i === today.length - 1))}</Card>
            </>
          ) : null}
          {earlier.length ? (
            <>
              <SectionTitle>Earlier</SectionTitle>
              <Card flat style={{ paddingVertical: 2 }}>{earlier.map((n, i) => row(n, i === earlier.length - 1))}</Card>
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}
