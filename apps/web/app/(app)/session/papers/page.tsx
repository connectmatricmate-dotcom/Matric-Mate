import type { Metadata } from 'next';
import { fbisePastPapersByYear } from '@matricmate/core';
import { PapersScreen } from '@/components/screens/PapersScreen';

export const metadata: Metadata = {
  title: 'Past papers',
  description: 'FBISE Class 9 past papers, straight from the board.',
};

export default function PapersPage() {
  const groups = fbisePastPapersByYear();
  return <PapersScreen groups={groups} />;
}
