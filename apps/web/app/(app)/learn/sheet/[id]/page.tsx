import type { Metadata } from 'next';
import { SheetScreen } from '@/components/screens/SheetScreen';

export const metadata: Metadata = {
  title: 'Revision sheet',
  description: 'A one-page AI revision sheet for this chapter.',
};

export default async function SheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SheetScreen chapterId={id} />;
}
