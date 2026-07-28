import type { Metadata } from 'next';
import { ProgressView } from '@/components/screens/ProgressView';

export const metadata: Metadata = {
  title: 'Progress',
  description: 'Syllabus covered, accuracy, weak topics and your monthly report card.',
};

export default function ProgressPage() {
  return <ProgressView />;
}
