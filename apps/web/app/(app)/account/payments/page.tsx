import type { Metadata } from 'next';
import { PaymentsView } from '@/components/screens/PaymentsView';

export const metadata: Metadata = {
  title: 'Payment history',
  description: 'Every Premium receipt, with the reference you can quote to support.',
};

export default function PaymentsPage() {
  return <PaymentsView />;
}
