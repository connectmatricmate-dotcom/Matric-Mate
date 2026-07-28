import type { Metadata } from 'next';
import { ExamScreen } from '@/components/screens/ExamScreen';

export const metadata: Metadata = { title: 'Timed test in progress' };

export default function ExamPage() {
  return <ExamScreen />;
}
