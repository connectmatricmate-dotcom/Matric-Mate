import type { Metadata } from 'next';
import { SessionSetup } from '@/components/screens/SessionSetup';

export const metadata: Metadata = {
  title: 'New MCQ session',
  description: 'Pick a subject, chapters and how many questions you want to practise.',
};

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ chapter?: string }> }) {
  const { chapter } = await searchParams;
  return <SessionSetup initialChapterId={chapter} />;
}
