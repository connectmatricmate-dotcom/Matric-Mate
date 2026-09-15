import type { Metadata } from 'next';
import { localTitle } from '@/lib/page-title';
import { ReportCard } from '@/components/screens/ReportCard';

export const generateMetadata = (): Promise<Metadata> => localTitle('progress.reportTitle', 'Your month in one page: grades by subject, active days and XP.');

export default function ReportPage() {
  return <ReportCard />;
}
