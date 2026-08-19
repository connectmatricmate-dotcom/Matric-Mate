import type { Metadata } from 'next';
import { AllChatsView } from '@/components/screens/AllChatsView';

export const metadata: Metadata = { title: 'Your chats' };

export default function AllChatsPage() {
  return <AllChatsView />;
}
