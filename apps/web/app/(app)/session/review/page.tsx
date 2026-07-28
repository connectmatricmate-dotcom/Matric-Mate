import type { Metadata } from 'next';
import { ReviewScreen } from '@/components/screens/ReviewScreen';

export const metadata: Metadata = { title: 'Review answers' };

export default function ReviewPage() {
  return <ReviewScreen />;
}
