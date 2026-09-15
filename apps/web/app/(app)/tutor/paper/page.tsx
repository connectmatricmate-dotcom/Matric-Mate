import type { Metadata } from 'next';
import { localTitle } from '@/lib/page-title';
import { PaperScreen } from '@/components/screens/PaperScreen';

export const generateMetadata = (): Promise<Metadata> => localTitle('tutor.paperTitle', 'A full board-pattern practice paper, timed and marked.');

export default async function PaperPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return <PaperScreen paperId={id} />;
}
