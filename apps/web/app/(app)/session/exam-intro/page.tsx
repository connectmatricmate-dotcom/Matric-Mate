import type { Metadata } from 'next';
import { ExamIntro } from '@/components/screens/ExamIntro';

export const metadata: Metadata = {
  title: 'Timed test',
  description: '20 questions, 30 minutes, double XP, exam conditions.',
};

export default async function ExamIntroPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; chapter?: string; paper?: string; ai?: string }>;
}) {
  const { subject, chapter, paper, ai } = await searchParams;
  return <ExamIntro subject={subject} chapter={chapter} paper={paper} ai={ai === '1'} />;
}
