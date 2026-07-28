import type { Metadata } from 'next';
import { TutorView } from '@/components/screens/TutorView';

export const metadata: Metadata = {
  title: 'AI Tutor',
  description: 'Ask anything about your chapters and get a step-by-step answer.',
};

export default function TutorPage() {
  return <TutorView />;
}
