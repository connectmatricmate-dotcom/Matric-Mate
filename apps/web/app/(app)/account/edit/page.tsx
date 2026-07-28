import type { Metadata } from 'next';
import { EditProfile } from '@/components/screens/EditProfile';

export const metadata: Metadata = { title: 'Edit profile' };

export default function EditPage() {
  return <EditProfile />;
}
