import type { Metadata } from 'next';
import { AccountView } from '@/components/screens/AccountView';

export const metadata: Metadata = {
  title: 'Profile',
  description: 'Your account, plan, downloads and settings.',
};

export default function AccountPage() {
  return <AccountView />;
}
