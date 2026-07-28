import type { Metadata } from 'next';
import { ReportCard } from '@/components/screens/ReportCard';

export const metadata: Metadata = {
  title: 'Report card',
  description: 'Your month in one page: grades by subject, active days and XP.',
};

export default function ReportPage() {
  return <ReportCard />;
}
