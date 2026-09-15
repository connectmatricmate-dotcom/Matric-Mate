import type { Metadata } from 'next';
import { localTitle } from '@/lib/page-title';
import { PerformanceScreen } from '@/components/screens/PerformanceScreen';

export const generateMetadata = (): Promise<Metadata> => localTitle('progress.perfTitle', 'Accuracy trend, questions per day, and how sure you were versus how right you were.');

export default function PerformancePage() {
  return <PerformanceScreen />;
}
