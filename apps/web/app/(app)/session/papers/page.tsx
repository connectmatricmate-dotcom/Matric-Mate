import type { Metadata } from 'next';
import { api } from '@matricmate/core';
import { PapersScreen } from '@/components/screens/PapersScreen';

export const metadata: Metadata = {
  title: 'Past papers',
  description: 'FBISE Class 9 past papers. Read them, or sit one as a timed test.',
};

export default async function PapersPage() {
  const papers = await api.getPastPapers();
  return <PapersScreen papers={papers} />;
}
