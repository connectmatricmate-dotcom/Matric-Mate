import type { Metadata } from 'next';
import { WeakTopicsScreen } from '@/components/screens/WeakTopicsScreen';

export const metadata: Metadata = {
  title: 'Weak topics',
  description: 'The topics your own answers say you should revise first.',
};

export default function WeakPage() {
  return <WeakTopicsScreen />;
}
