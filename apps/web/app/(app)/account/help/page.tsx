import type { Metadata } from 'next';
import { HelpView } from '@/components/screens/HelpView';
import { onlinePayments } from '@/lib/gateway';
import { localTitle } from '@/lib/page-title';

export const generateMetadata = (): Promise<Metadata> =>
  localTitle('account.helpTitle', 'Common questions, and how to reach us if you are still stuck.');

/** Whether paying online is open decides how the renew answer reads. */
export default function HelpPage() {
  return <HelpView online={onlinePayments()} />;
}
