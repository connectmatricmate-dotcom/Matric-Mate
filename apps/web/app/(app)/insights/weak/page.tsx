import type { Metadata } from 'next';
import { localTitle } from '@/lib/page-title';
import { WeakTopicsScreen } from '@/components/screens/WeakTopicsScreen';

export const generateMetadata = (): Promise<Metadata> => localTitle('progress.weakTitle', 'The topics your own answers say you should revise first.');

export default function WeakPage() {
  return <WeakTopicsScreen />;
}
