import type { Metadata } from 'next';
import { localTitle } from '@/lib/page-title';
import { ResultScreen } from '@/components/screens/ResultScreen';

export const generateMetadata = (): Promise<Metadata> => localTitle('session.resultPageTitle');

export default function ResultPage() {
  return <ResultScreen />;
}
