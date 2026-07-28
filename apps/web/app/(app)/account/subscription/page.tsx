import type { Metadata } from 'next';
import { SubscriptionView } from '@/components/screens/SubscriptionView';

export const metadata: Metadata = {
  title: 'Subscription',
  description: 'What your plan includes, when it ends, and how to renew or cancel.',
};

export default function SubscriptionPage() {
  return <SubscriptionView />;
}
