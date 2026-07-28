import type { Metadata } from 'next';
import { McqScreen } from '@/components/screens/McqScreen';

export const metadata: Metadata = { title: 'Practice MCQs' };

export default function McqPage() {
  return <McqScreen />;
}
