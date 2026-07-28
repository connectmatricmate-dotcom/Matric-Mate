import type { Metadata } from 'next';
import { ChooseSubjects } from '@/components/onboarding/ChooseSubjects';

export const metadata: Metadata = { title: 'Your subjects' };

export default function SubjectsPage() {
  return <ChooseSubjects />;
}
