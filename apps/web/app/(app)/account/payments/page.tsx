import type { Metadata } from 'next';
import { PaymentsView, type PaymentRow } from '@/components/screens/PaymentsView';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Payment history',
  description: 'Every Premium receipt, with the reference you can quote to support.',
};

/**
 * The rows are read here, on the server, under the student's own session and
 * RLS. The screen used to fetch them in a client effect, which meant a second
 * round trip after render and, when the query failed, a skeleton that spun
 * forever because the error was thrown away.
 */
export default async function PaymentsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('payments')
    .select('id, plan, amount, status, reference, at')
    .order('at', { ascending: false });

  return <PaymentsView rows={(data as PaymentRow[] | null) ?? []} failed={Boolean(error)} />;
}
