import type { Metadata } from 'next';
import { localTitle } from '@/lib/page-title';
import { ReviewScreen } from '@/components/screens/ReviewScreen';

export const generateMetadata = (): Promise<Metadata> => localTitle('session.reviewAnswers');

export default function ReviewPage() {
  return <ReviewScreen />;
}
