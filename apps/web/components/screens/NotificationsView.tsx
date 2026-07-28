'use client';

import { useEffect, useMemo } from 'react';
import type { Notification, NotificationTarget } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { Card, Empty, Item, SectionTitle } from '@/components/ui/primitives';
import { useApp, useT } from '@/lib/store';

/** Shared destinations, in this app's route names. See NotificationTarget. */
const ROUTE: Record<NotificationTarget, string> = {
  home: '/dashboard',
  study: '/study',
  practice: '/practice',
  progress: '/progress',
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

export function NotificationsView() {
  const { state, actions } = useApp();
  const t = useT();

  // A short delay so the unread dot is still visible when the page opens.
  useEffect(() => {
    const timer = setTimeout(() => actions.readNotifications(), 400);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { today, earlier } = useMemo(() => {
    const start = new Date().setHours(0, 0, 0, 0);
    return {
      today: state.notifications.filter((n) => n.at >= start),
      earlier: state.notifications.filter((n) => n.at < start),
    };
  }, [state.notifications]);

  const row = (n: Notification, last: boolean) => {
    const meta = ICON[n.kind];
    return (
      <Item
        key={n.id}
        href={n.target ? ROUTE[n.target] : undefined}
        title={n.title}
        sub={n.body}
        emoji={meta.emoji}
        tone={meta.tone}
        last={last}
      />
    );
  };

  return (
    <Page width="focus">
      <PageHead back="/dashboard" backLabel={t('tabs.home')} title={t('notifications.title')} />

      {state.notifications.length === 0 ? (
        <Empty emoji="🔔" title={t('notifications.emptyTitle')} sub={t('notifications.emptyBody')} />
      ) : (
        <>
          {today.length ? (
            <>
              <SectionTitle>{t('notifications.today')}</SectionTitle>
              <Card flat className="py-0">
                {today.map((n, i) => row(n, i === today.length - 1))}
              </Card>
            </>
          ) : null}
          {earlier.length ? (
            <>
              <SectionTitle>{t('notifications.earlier')}</SectionTitle>
              <Card flat className="py-0">
                {earlier.map((n, i) => row(n, i === earlier.length - 1))}
              </Card>
            </>
          ) : null}
        </>
      )}
    </Page>
  );
}
