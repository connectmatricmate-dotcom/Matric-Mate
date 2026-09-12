import type { Metadata } from 'next';
import { ChooseSubjects } from '@/components/onboarding/ChooseSubjects';

export const metadata: Metadata = { title: 'Your subjects' };

/** `?edit=1` when opened from Edit profile: save this one step and go back there. */
export default async function SubjectsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  return <ChooseSubjects edit={edit === '1'} />;
}
