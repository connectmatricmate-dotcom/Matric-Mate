import type { Metadata } from 'next';
import { CertificatesView, type CertRow } from '@/components/screens/CertificatesView';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Verified by teachers',
  description: 'Teachers who reviewed MatricMate study material and certified it.',
};

export default async function CertificatesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('certificates')
    .select('id, teacher, title, issued_on')
    .order('position')
    .limit(50);

  return <CertificatesView rows={(data as CertRow[] | null) ?? []} failed={Boolean(error)} />;
}
