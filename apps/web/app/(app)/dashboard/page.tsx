import type { Metadata } from 'next';
import { localTitle } from '@/lib/page-title';
import { DashboardView } from '@/components/screens/DashboardView';

export const generateMetadata = (): Promise<Metadata> => localTitle('tabs.home', 'Your plan for today, what to continue, and this week at a glance.');

export default function DashboardPage() {
  return <DashboardView />;
}
