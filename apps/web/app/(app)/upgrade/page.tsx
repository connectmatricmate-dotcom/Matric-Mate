import type { Metadata } from 'next';
import { UpgradeView } from '@/components/screens/UpgradeView';

export const metadata: Metadata = {
  title: 'Start your plan',
  description: 'One plan, Rs 1,000 a month. Every chapter, every question and the AI tutor.',
};

/** The gate lives in the layout, which decides before anything streams. */
export default function UpgradePage() {
  return <UpgradeView />;
}
