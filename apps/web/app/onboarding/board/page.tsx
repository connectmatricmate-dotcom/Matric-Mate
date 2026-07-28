import type { Metadata } from 'next';
import { ChooseBoard } from '@/components/onboarding/ChooseBoard';

export const metadata: Metadata = { title: 'Your board' };

export default function BoardPage() {
  return <ChooseBoard />;
}
