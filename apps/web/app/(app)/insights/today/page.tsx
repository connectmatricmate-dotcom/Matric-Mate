import type { Metadata } from 'next';
import { DailyReportView } from '@/components/screens/DailyReportView';

export const metadata: Metadata = {
  title: 'Daily report',
  description: 'What you studied today: time spent, questions answered, notes read and tests finished.',
};

export default function DailyReportPage() {
  return <DailyReportView />;
}
