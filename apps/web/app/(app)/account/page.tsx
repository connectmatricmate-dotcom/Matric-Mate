import type { Metadata } from 'next';
import { localTitle } from '@/lib/page-title';
import { AccountView } from '@/components/screens/AccountView';

export const generateMetadata = (): Promise<Metadata> => localTitle('account.settingsTitle', 'Your account, plan, downloads and settings.');

export default function AccountPage() {
  return <AccountView />;
}
