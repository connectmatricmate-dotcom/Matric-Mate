import type { Metadata } from 'next';
import { AiTestScreen } from '@/components/screens/AiTestScreen';

export const metadata: Metadata = {
  title: 'AI test',
  description: 'A paper built from the topics you keep getting wrong.',
};

export default function AiTestPage() {
  return <AiTestScreen />;
}
