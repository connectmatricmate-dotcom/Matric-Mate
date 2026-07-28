import type { Metadata } from 'next';
import { NotificationsView } from '@/components/screens/NotificationsView';

export const metadata: Metadata = {
  title: 'Notifications',
  description: 'Reminders about your plan, streaks and report card.',
};

export default function NotificationsPage() {
  return <NotificationsView />;
}
