import type { Metadata } from 'next';
import { localTitle } from '@/lib/page-title';
import { EditProfile } from '@/components/screens/EditProfile';

export const generateMetadata = (): Promise<Metadata> => localTitle('account.editTitle');

export default function EditPage() {
  return <EditProfile />;
}
