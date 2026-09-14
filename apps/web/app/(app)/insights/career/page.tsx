import type { Metadata } from 'next';
import { AiLocked } from '@/components/app/AiLocked';
import { CareerView } from '@/components/screens/CareerView';
import { currentAccess } from '@/lib/entitlement';

export const metadata: Metadata = {
  title: 'Career guidance',
  description: 'Which Class 11 group and which fields your practice results point to, and why.',
};

export default async function CareerPage() {
  // Written by the AI, so it is Premium's; the route refuses Basic as well.
  const access = await currentAccess();
  if (!access.ai) return <AiLocked titleKey="career.title" back="/progress" backLabelKey="progress.title" />;
  return <CareerView />;
}
