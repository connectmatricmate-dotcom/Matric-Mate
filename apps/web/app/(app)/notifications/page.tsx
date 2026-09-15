import type { Metadata } from 'next';
import { localTitle } from '@/lib/page-title';
import { NotificationsView } from '@/components/screens/NotificationsView';

export const generateMetadata = (): Promise<Metadata> => localTitle('notifications.title', 'Reminders about your plan, streaks and report card.');

export default function NotificationsPage() {
  return <NotificationsView />;
}
