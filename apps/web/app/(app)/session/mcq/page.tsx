import type { Metadata } from 'next';
import { localTitle } from '@/lib/page-title';
import { McqScreen } from '@/components/screens/McqScreen';

export const generateMetadata = (): Promise<Metadata> => localTitle('study.mcqs');

export default function McqPage() {
  return <McqScreen />;
}
