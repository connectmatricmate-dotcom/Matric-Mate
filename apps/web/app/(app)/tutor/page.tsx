import type { Metadata } from 'next';
import { localTitle } from '@/lib/page-title';
import { TutorView } from '@/components/screens/TutorView';

export const generateMetadata = (): Promise<Metadata> => localTitle('tutor.title', 'Ask anything about your chapters and get a step-by-step answer.');

export default function TutorPage() {
  return <TutorView />;
}
