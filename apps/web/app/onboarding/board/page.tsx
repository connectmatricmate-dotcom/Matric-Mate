import type { Metadata } from 'next';
import { ChooseBoard } from '@/components/onboarding/ChooseBoard';

export const metadata: Metadata = { title: 'Your board' };

/** `?edit=1` when opened from Edit profile: save this one step and go back there. */
export default async function BoardPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  return <ChooseBoard edit={edit === '1'} />;
}
