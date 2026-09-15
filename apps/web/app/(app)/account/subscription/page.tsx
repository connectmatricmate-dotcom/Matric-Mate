import type { Metadata } from 'next';
import { localTitle } from '@/lib/page-title';
import { SubscriptionView } from '@/components/screens/SubscriptionView';

export const generateMetadata = (): Promise<Metadata> => localTitle('account.subscriptionTitle', 'What your plan includes, when it ends, and how to renew or cancel.');

export default function SubscriptionPage() {
  return <SubscriptionView />;
}
