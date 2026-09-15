import type { Metadata } from 'next';
import { localTitle } from '@/lib/page-title';
import { AllChatsView } from '@/components/screens/AllChatsView';

export const generateMetadata = (): Promise<Metadata> => localTitle('tutor.allChatsTitle');

export default function AllChatsPage() {
  return <AllChatsView />;
}
