'use client';

import { useEffect, useMemo } from 'react';
import type { Notification, NotificationTarget } from '@matricmate/core';
import { Page, PageHead } from '@/components/app/Page';
import { RowsSkeleton } from '@/components/app/skeletons';
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

const ICON: Record<Notification['kind'], { icon: 'flame' | 'clock' | 'chart' | 'receipt'; tone: 'orange' | 'teal' | 'green' | 'grey' }> = {
  streak: { icon: 'flame', tone: 'orange' },
  reminder: { icon: 'clock', tone: 'teal' },
  report: { icon: 'chart', tone: 'green' },
  payment: { icon: 'receipt', tone: 'grey' },
};

export function NotificationsView() {
  const { state, synced, actions } = useApp();
  const t = useT();
  const unread = state.notifications.some((n) => !n.read);

  /*
   * Marked read once the account's inbox is actually here, and again for
   * anything that arrives while the page is open. It ran once, 400ms after
   * opening, which on a new browser was before the rows had come back: they
   * then arrived unread and stayed that way. The short delay is so the
   * unread dot is still visible when the page opens.
   */
  useEffect(() => {
    if (!unread || !synced) return;
    const timer = setTimeout(() => actions.readNotifications(), 400);
    return () => clearTimeout(timer);
  }, [unread, synced, actions]);

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
        href={n.target ? ROUTE[n.target] : undefined}
        title={n.title}
        sub={n.body}
        icon={meta.icon}
        tone={meta.tone}
        last={last}
      />
    );
  };

  return (
    <Page width="focus">
      <PageHead back="/dashboard" backLabel={t('tabs.home')} title={t('notifications.title')} />

      {state.notifications.length === 0 && !synced ? (
        // Not "nothing here" before the inbox has been read: that is the
        // wrong half of the pair for a student with receipts waiting.
        <RowsSkeleton rows={3} />
      ) : state.notifications.length === 0 ? (
        <Empty icon="bell" title={t('notifications.emptyTitle')} sub={t('notifications.emptyBody')} />
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
