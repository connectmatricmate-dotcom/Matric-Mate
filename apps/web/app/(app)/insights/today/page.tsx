import type { Metadata } from 'next';
import { localTitle } from '@/lib/page-title';
import { DailyReportView } from '@/components/screens/DailyReportView';

export const generateMetadata = (): Promise<Metadata> => localTitle('today.title', 'What you studied today: time spent, questions answered, notes read and tests finished.');

export default function DailyReportPage() {
  return <DailyReportView />;
}
