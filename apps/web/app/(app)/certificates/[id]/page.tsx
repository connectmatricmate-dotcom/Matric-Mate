import type { Metadata } from 'next';
import { localTitle } from '@/lib/page-title';
import { notFound } from 'next/navigation';
import { CertificateDetail, type CertDetailRow } from '@/components/screens/CertificateDetail';
import { createClient } from '@/lib/supabase/server';

export const generateMetadata = (): Promise<Metadata> => localTitle('cert.title', 'A teacher verification certificate for MatricMate study material.');

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('certificates')
    .select('id, teacher, title, bio, image_url, issued_on')
    .eq('id', id)
    .maybeSingle();

  if (!data) notFound();
  return <CertificateDetail cert={data as CertDetailRow} />;
}
