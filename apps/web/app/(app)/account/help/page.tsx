import type { Metadata } from 'next';
import { HelpView } from '@/components/screens/HelpView';

export const metadata: Metadata = {
  title: 'Help and support',
  description: 'Common questions, and how to reach us if you are still stuck.',
};

export default function HelpPage() {
  return <HelpView />;
}
