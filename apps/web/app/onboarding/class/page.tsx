import type { Metadata } from 'next';
import { ChooseClass } from '@/components/onboarding/ChooseClass';

export const metadata: Metadata = { title: 'Your class' };

export default function ClassPage() {
  return <ChooseClass />;
}
