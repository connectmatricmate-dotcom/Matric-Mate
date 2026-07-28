import type { Metadata } from 'next';
import { PerformanceScreen } from '@/components/screens/PerformanceScreen';

export const metadata: Metadata = {
  title: 'Performance',
  description: 'Accuracy trend, questions per day, and how sure you were versus how right you were.',
};

export default function PerformancePage() {
  return <PerformanceScreen />;
}
