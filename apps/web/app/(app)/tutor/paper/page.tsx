import type { Metadata } from 'next';
import { PaperScreen } from '@/components/screens/PaperScreen';

export const metadata: Metadata = {
  title: 'Board mock paper',
  description: 'A full board-pattern practice paper, timed and marked.',
};

export default async function PaperPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return <PaperScreen paperId={id} />;
}
