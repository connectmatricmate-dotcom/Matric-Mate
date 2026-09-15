import type { Metadata } from 'next';
import { localTitle } from '@/lib/page-title';
import { ProgressView } from '@/components/screens/ProgressView';

export const generateMetadata = (): Promise<Metadata> => localTitle('tabs.progress', 'Syllabus covered, accuracy, weak topics and your monthly report card.');

export default function ProgressPage() {
  return <ProgressView />;
}
