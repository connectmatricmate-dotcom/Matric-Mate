import type { Metadata } from 'next';
import { ForgotForm } from '@/components/auth/ForgotForm';

export const metadata: Metadata = {
  title: 'Reset password',
  description: 'Send yourself a link to reset your MatricMate password.',
};

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  // The auth callback lands here with ?error=expired when a reset link is too
  // old to honour; the form explains that instead of silently starting over.
  const { error } = await searchParams;
  return <ForgotForm linkExpired={error === 'expired'} />;
}
