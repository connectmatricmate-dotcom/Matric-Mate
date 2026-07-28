import type { Metadata } from 'next';
import { DashboardView } from '@/components/screens/DashboardView';

export const metadata: Metadata = {
  title: 'Home',
  description: 'Your plan for today, what to continue, and this week at a glance.',
};

export default function DashboardPage() {
  return <DashboardView />;
}
