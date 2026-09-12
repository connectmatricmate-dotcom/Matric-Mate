import type { Metadata } from 'next';
import { ChooseMedium } from '@/components/onboarding/ChooseMedium';

export const metadata: Metadata = { title: 'Your medium' };

/** `?edit=1` when opened from Edit profile: save this one step and go back there. */
export default async function MediumPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  return <ChooseMedium edit={edit === '1'} />;
}
