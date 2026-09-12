import type { Metadata } from 'next';
import { ChooseClass } from '@/components/onboarding/ChooseClass';

export const metadata: Metadata = { title: 'Your class' };

/** `?edit=1` when opened from Edit profile: save this one step and go back there. */
export default async function ClassPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  return <ChooseClass edit={edit === '1'} />;
}
