import type { Metadata } from 'next';
import { localTitle } from '@/lib/page-title';
import { ExamScreen } from '@/components/screens/ExamScreen';

export const generateMetadata = (): Promise<Metadata> => localTitle('session.examTitle');

export default function ExamPage() {
  return <ExamScreen />;
}
