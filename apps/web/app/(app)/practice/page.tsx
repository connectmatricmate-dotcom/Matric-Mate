import type { Metadata } from 'next';
import { PracticeView } from '@/components/screens/PracticeView';

export const metadata: Metadata = {
  title: 'Practice',
  description: 'MCQs, flashcards, fill in the blanks, short questions, past papers and timed tests.',
};

export default function PracticePage() {
  return <PracticeView />;
}
