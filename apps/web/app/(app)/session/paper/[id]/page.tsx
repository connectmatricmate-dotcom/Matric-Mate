import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PAPER_CONTENT, PAST_PAPERS, paperContent, subjectById } from '@matricmate/core';
import { PaperViewer } from '@/components/screens/PaperViewer';

type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return PAST_PAPERS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const paper = PAST_PAPERS.find((p) => p.id === id);
  return paper
    ? {
        title: `FBISE ${paper.year} ${subjectById(paper.subjectId)?.name} paper`,
        description: `The full FBISE SSC-I ${paper.year} ${subjectById(paper.subjectId)?.name} paper, ${paper.marks} marks.`,
      }
    : { title: 'Past paper' };
}

export default async function PaperPage({ params }: Props) {
  const { id } = await params;
  const paper = PAST_PAPERS.find((p) => p.id === id);
  if (!paper) notFound();

  return (
    <PaperViewer
      paper={paper}
      subjectName={subjectById(paper.subjectId)?.name ?? ''}
      sections={paperContent(id)}
      isReal={!!PAPER_CONTENT[id]}
    />
  );
}
