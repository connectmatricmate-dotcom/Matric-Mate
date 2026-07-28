import type { Metadata } from 'next';
import { ChooseMedium } from '@/components/onboarding/ChooseMedium';

export const metadata: Metadata = { title: 'Your medium' };

export default function MediumPage() {
  return <ChooseMedium />;
}
