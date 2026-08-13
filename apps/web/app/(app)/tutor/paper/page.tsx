import type { Metadata } from 'next';
import { PaperScreen } from '@/components/screens/PaperScreen';

export const metadata: Metadata = {
  title: 'Board mock paper',
  description: 'A full FBISE-pattern paper, weighted like the real one.',
};

export default async function PaperPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return <PaperScreen paperId={id} />;
}
